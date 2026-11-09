/**
 * 会话接续块（P1-B，2026-10-28）。
 *
 * 目标：让模型每轮都知道「当前进行中的任务是什么、停在哪」，但**绝不**
 * 把已完成的任务塞进上下文。
 *
 * 任务边界直接复用 dtodo：dtodo 条目本身就是任务，带 status / due /
 * quadrant / time，不需要另造一套任务表。规则：
 *
 * - 只取 status ∈ {pending, doing, blocked}；done / cancelled 永不注入。
 *   已完成的仍然留在 TODOS.md 里，需要时 `dtodo list status=done` 就能搜到。
 * - 排序：blocked（被卡住）→ 有 due（越早越前，逾期最前）→ 象限 q1..q4
 *   → 更新时间倒序。
 * - 每条一行：`[q1] 标题（截止 10-30）`，可附「最近：<日志片段>」。
 * - 最近进展：用标题里的关键词去 project 日志尾部匹配最近一条，截短。
 * - 无未完成任务时返回 ''（不产生任何 token）。
 *
 * @module continuity
 */
import { todayStamp } from './store.js'

const ACTIVE_STATUSES = new Set(['pending', 'doing', 'blocked'])
const QUAD_RANK = { q1: 0, q2: 1, q3: 2, q4: 3 }

// 正文自带「已完成」标记但 status 没改的任务（历史数据常见）：视为已完成跳过，
// 避免把做完的事当成进行中注入。只认显式标记，不做语义猜测。
const COMPLETED_HINT = /【已完成】|\[已完成\]|\[done\]/i

/** 取第一条非空行（任务标题）。 */
function firstLine(text) {
  for (const line of String(text ?? '').split('\n')) {
    const t = line.trim()
    if (t) return t
  }
  return ''
}

/** 压成一行并截断。 */
function clip(value, max) {
  const t = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * 从标题提取日志匹配用的关键词。
 *
 * 中文：取每个中文串的**前 3 字**作为强关键词（中文词多为 2–4 字，截太短
 * 易误命中、截成 4 字又会像「云桥杯飞书表单提交」那样跨词错位）；再取首个
 * 中文串的前 2 字作为弱关键词兜底。英文：取长度 ≥3 的词。
 * 强关键词优先匹配，全部落空才用弱关键词。纯本地 substring，不计费。
 */
function keywordsOf(title) {
  const chunks = [...title.matchAll(/[\u4e00-\u9fff]{2,}/g)].map((m) => m[0])
  const strong = []
  for (const chunk of chunks) {
    // 2 字词太泛（「视频」「内部」会命中任何提到它的日志），不进强关键词。
    if (chunk.length < 3) continue
    strong.push(chunk.slice(0, 3))
    if (strong.length >= 3) break
  }
  for (const m of title.matchAll(/[A-Za-z][A-Za-z0-9_-]{2,}/g)) {
    if (strong.length >= 3) break
    strong.push(m[0])
  }
  const weak = chunks.length > 0 ? [chunks[0].slice(0, 2)] : []
  return { strong: [...new Set(strong)], weak: [...new Set(weak)] }
}

/**
 * 在 project 日志尾部找最近一条提到该任务关键词的记录（从新到旧，最多看 80 条）。
 * 先按强关键词匹配；强关键词全落空才退到弱关键词（避免「任务」「提交」这类
 * 泛词把不相干的日志带进来）。日志条目的时间戳前缀会被剥掉，只留正文。
 * @returns {string} 命中的日志正文（未截断），没有命中返回 ''。
 */
function latestProjectLog(memoryStore, agent, keywords) {
  if (!memoryStore) return ''
  const { strong = [], weak = [] } = keywords || {}
  const pools = [strong, weak].filter((p) => p.length > 0)
  if (pools.length === 0) return ''
  let entries = []
  try {
    entries = memoryStore.entriesOf('project', agent) || []
  } catch {
    return ''
  }
  const start = Math.max(0, entries.length - 80)
  for (const pool of pools) {
    for (let i = entries.length - 1; i >= start; i -= 1) {
      const text = entries[i]
      if (pool.some((k) => text.includes(k))) {
        return text
          .replace(/^\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, '')
          .replace(/\s*\n\s*/g, ' ')
          .trim()
      }
    }
  }
  return ''
}

/** 日期字符串（YYYY-MM-DD）往前推 n 天。 */
function daysAgo(stamp, n) {
  const d = new Date(`${stamp}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** 排序键：blocked 优先 → 未过期先于「过期超 3 天」→ 有 due → due 升序 → 象限。 */
function rankOf(item, staleCutoff) {
  const stale = Boolean(item.due) && item.due < staleCutoff
  return [
    item.status === 'blocked' ? 0 : 1,
    stale ? 1 : 0,
    item.due ? 0 : 1,
    item.due ?? '9999-12-31',
    QUAD_RANK[item.quadrant] ?? 4,
  ]
}

function compareItems(a, b, staleCutoff) {
  const ra = rankOf(a, staleCutoff)
  const rb = rankOf(b, staleCutoff)
  for (let i = 0; i < ra.length; i += 1) {
    if (ra[i] < rb[i]) return -1
    if (ra[i] > rb[i]) return 1
  }
  // 同一档：更新的排前面（time 形如 YYYY-MM-DD HH:MM）
  if (a.time && b.time) return a.time < b.time ? 1 : -1
  return 0
}

/**
 * 构建「进行中任务」注入块。
 *
 * @param {object} options
 * @param {import('./todo.js').TodoStore} options.todoStore - 待办存储。
 * @param {object} [options.memoryStore] - 记忆存储（用于匹配最近进展）。
 * @param {object} options.agent - DSH agent（读取 session cwd）。
 * @param {object} options.config - 插件配置。
 * @returns {string} 注入块文本；无未完成任务时为 ''。
 */
export function buildContinuityBlock({ todoStore, memoryStore, agent, config } = {}) {
  if (!todoStore) return ''
  const cwd = agent?.session?.header?.cwd
  if (!cwd) return ''

  const maxItems = Number(config?.continuityMaxItems) || 3
  const maxChars = Number(config?.continuityMaxChars) || 320
  const maxTitle = Number(config?.continuityMaxTitleChars) || 36
  const maxLog = Number(config?.continuityMaxLogChars) || 40

  let items = []
  try {
    items = todoStore.itemsOf('project', cwd) || []
  } catch {
    return ''
  }
  const active = items.filter(
    (it) => ACTIVE_STATUSES.has(it.status) && firstLine(it.text) && !COMPLETED_HINT.test(it.text),
  )
  if (active.length === 0) return ''
  // 逾期超过 3 天的任务降权：它们多是「忘了关」的数据事实，而有截止日期的
  // 才是要动手的。避免过期项占满 3 个名额、把真正要交的活挤进「另有 N 条」。
  const staleCutoff = daysAgo(todayStamp(), 3)
  active.sort((a, b) => compareItems(a, b, staleCutoff))

  // 多个任务共享的关键词（项目名、阶段名）不能拿来匹配日志：它们会把同一条
  // 泛泛的日志挂到每一条任务上（实例：「云桥杯」出现在三条任务里，三条都
  // 挂上同一句「最近」）。只保留在本批任务标题中只出现一次的独有关键词。
  const keywordCount = new Map()
  for (const item of active) {
    for (const k of keywordsOf(firstLine(item.text)).strong) {
      keywordCount.set(k, (keywordCount.get(k) || 0) + 1)
    }
  }
  const uniqueKeywords = (item) => {
    const { strong, weak } = keywordsOf(firstLine(item.text))
    return {
      strong: strong.filter((k) => keywordCount.get(k) === 1),
      weak: weak.filter((k) => keywordCount.get(k) === 1),
    }
  }

  const today = todayStamp()
  // 「最近」这一列默认关闭（continuityShowLog=true 才开）：project 日志正文
  // 经常提到任务名，会把「关于记忆系统的那条日志」匹配成飞书表单的进展——
  // 字面命中但不合语境，属于自我污染，不如只留标题 + 截止日期干净。
  const showLog = config?.continuityShowLog === true
  const lines = []
  const usedLogs = new Set()
  let used = 0
  for (const item of active) {
    if (lines.length >= maxItems) break
    const title = clip(firstLine(item.text), maxTitle)
    const flags = []
    if (item.status === 'blocked') flags.push('被阻塞')
    if (item.due) {
      flags.push(item.due < today ? `已逾期 ${item.due}` : `截止 ${item.due.slice(5)}`)
    }
    const log = showLog ? latestProjectLog(memoryStore, agent, uniqueKeywords(item)) : ''
    // 同一条日志只附给第一条命中的任务，避免重复占预算。
    const logText = log && !usedLogs.has(log) ? clip(log, maxLog) : ''
    if (logText) usedLogs.add(log)
    let line = `- ${item.quadrant ? `[${item.quadrant}] ` : ''}${title}`
    if (flags.length > 0) line += `（${flags.join('，')}）`
    if (logText) line += `｜最近：${logText}`
    // 至少保留一条，避免预算过小时整块消失
    if (lines.length > 0 && used + line.length > maxChars) break
    lines.push(line)
    used += line.length
  }

  const hidden = active.length - lines.length
  const tail = hidden > 0 ? `\n> 另有 ${hidden} 条未完成，用 dtodo list 查看。` : ''
  return `## 进行中任务（自动接续；已完成不在此列，需要时用 dtodo list status=done 查）\n${lines.join('\n')}${tail}`
}
