/**
 * 通知提示音（铃铛与设置面板共用）。
 *
 * 设计要点（2026-09-12）：
 *   - 单例 AudioContext + 首次用户手势解锁：定时器/后台标签页里临时创建的音频
 *     上下文基本都是 suspended，只有提前在用户手势里 resume 过的那个才保证出声；
 *   - 两个内置预设（可在设置面板切换，存 localStorage）：
 *       'k-on'  「轻音风过场」——明亮钟琴琶音上行 + 跳跃回落 + 长音收尾；
 *       'chime' 「叮咚」——两声清脆铃声（旧版默认）；
 *   - 自定义录音：把 CUSTOM_SOUND_DATA_URI 填成 `data:audio/mpeg;base64,...` 即用
 *     录音替换（优先级最高，不依赖任何权限、不需要改宿主）。
 */

/**
 * 自定义提示音。空字符串 = 使用内置合成音；填入 data URI 即播放该录音（优先级最高）。
 * 例：'data:audio/mpeg;base64,//uQxAAA...'
 */
export const CUSTOM_SOUND_DATA_URI = ''

export type SoundPreset = 'k-on' | 'chime'

const PRESET_KEY = 'dsh-memory-evolve.notifySoundPreset'

let ctxRef: AudioContext | null = null
let silentBlipDone = false
let activePreset: SoundPreset = 'k-on'

if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem(PRESET_KEY)
    if (saved === 'k-on' || saved === 'chime') activePreset = saved
  } catch { /* best-effort */ }
}

/** 当前预设。 */
export function getSoundPreset(): SoundPreset {
  return activePreset
}

/** 切换预设并记住（localStorage 不可用时仅本次生效）。 */
export function setSoundPreset(preset: SoundPreset): void {
  activePreset = preset
  try {
    window.localStorage.setItem(PRESET_KEY, preset)
  } catch { /* best-effort */ }
}

interface AudioWindow {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

/** 取浏览器可用的 AudioContext 构造器（兼容 webkit 前缀）。 */
function audioClass(): typeof AudioContext | undefined {
  const win = window as unknown as AudioWindow
  return win.AudioContext ?? win.webkitAudioContext
}

/** 取（或懒建）单例音频上下文；不可用时返回 null（尽力而为）。 */
function getCtx(): AudioContext | null {
  try {
    if (ctxRef !== null) return ctxRef
    const Ctor = audioClass()
    if (!Ctor) return null
    ctxRef = new Ctor()
    return ctxRef
  } catch {
    return null
  }
}

/**
 * 在用户手势里调用即可解锁音频（幂等，可重复调用）。
 * 页面首次点击/按键会自动调用一次；设置面板拨动开关、点「试听」也会调用。
 * 解锁之后，即使标签页在后台、由定时器触发，也能正常出声。
 */
export function unlockNotifySound(): void {
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => { /* best-effort */ })
    }
    if (!silentBlipDone) {
      silentBlipDone = true
      // 部分浏览器要求「真正播放过一次」才算解锁：放一个 10ms 的静音帧。
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      osc.start(now)
      osc.stop(now + 0.01)
    }
  } catch { /* best-effort */ }
}

interface JingleNote {
  /** 基频 Hz */
  freq: number
  /** 相对起点的秒数 */
  at: number
  /** 持续时间（秒） */
  dur: number
  /** 峰值增益 */
  peak: number
}

/**
 * 通用音型播放：每个音用「三角波基音 + 2/3 倍频正弦泛音」合成钟琴/马林巴音色，
 * 指数衰减尾音。整体再过一个 master 增益，避免多音叠加削顶。
 */
function playJingle(ctx: AudioContext, notes: JingleNote[], master: number): void {
  const out = ctx.createGain()
  out.gain.value = master
  out.connect(ctx.destination)
  const t0 = ctx.currentTime
  const partials: Array<[number, number, OscillatorType]> = [
    [1, 1, 'triangle'],
    [2, 0.2, 'sine'],
    [3, 0.08, 'sine'],
  ]
  for (const note of notes) {
    for (const [mul, ampMul, type] of partials) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = note.freq * mul
      osc.connect(gain)
      gain.connect(out)
      const start = t0 + note.at
      const amp = note.peak * ampMul
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(amp, start + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur)
      osc.start(start)
      osc.stop(start + note.dur + 0.03)
    }
  }
  const total = Math.max(...notes.map((n) => n.at + n.dur)) + 0.15
  window.setTimeout(() => {
    try {
      out.disconnect()
    } catch { /* best-effort */ }
  }, total * 1000)
}

/**
 * 「轻音风过场」：明亮的五连音上行（G5-C6-E6-G6-C7）+ 跳跃回落 + 长音收尾，
 * 底下铺 C4/G4/C4 的马林巴低音。约 1.1 秒，清爽有跳跃感。
 */
const EYECATCH: JingleNote[] = [
  // 低音铺底
  { freq: 261.63, at: 0.0, dur: 0.22, peak: 0.3 },
  { freq: 392.0, at: 0.28, dur: 0.2, peak: 0.26 },
  { freq: 261.63, at: 0.5, dur: 0.5, peak: 0.3 },
  // 上行五连音
  { freq: 783.99, at: 0.0, dur: 0.16, peak: 0.42 },
  { freq: 1046.5, at: 0.07, dur: 0.16, peak: 0.46 },
  { freq: 1318.51, at: 0.14, dur: 0.16, peak: 0.5 },
  { freq: 1567.98, at: 0.21, dur: 0.18, peak: 0.52 },
  { freq: 2093.0, at: 0.28, dur: 0.24, peak: 0.55 },
  // 跳跃回落 + 收尾长音
  { freq: 1318.51, at: 0.42, dur: 0.12, peak: 0.4 },
  { freq: 2093.0, at: 0.5, dur: 0.6, peak: 0.55 },
]

/** 合成「叮咚」两声（峰值 0.55，带 2 倍频泛音提升穿透力）。 */
const CHIME: JingleNote[] = [
  { freq: 1318.5, at: 0, dur: 0.28, peak: 0.55 },
  { freq: 987.8, at: 0.18, dur: 0.55, peak: 0.5 },
]

/** 播放自定义录音（CUSTOM_SOUND_DATA_URI 非空时走这里）。 */
function playCustom(src: string): void {
  try {
    const el = new Audio(src)
    el.volume = 1
    void el.play().catch(() => { /* best-effort */ })
  } catch { /* best-effort */ }
}

/** 按当前预设合成一段音。 */
function playSynthesized(ctx: AudioContext, preset: SoundPreset): void {
  if (preset === 'chime') {
    playJingle(ctx, CHIME, 1)
    return
  }
  // 轻音风过场：音多，master 压到 0.6 防止叠加削顶。
  playJingle(ctx, EYECATCH, 0.6)
}

/** 播一次提示音（尽力而为，任何失败都静默——绝不影响通知本身）。 */
export function playNotifySound(): void {
  if (CUSTOM_SOUND_DATA_URI !== '') {
    playCustom(CUSTOM_SOUND_DATA_URI)
    return
  }
  const preset = activePreset
  try {
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          try {
            playSynthesized(ctx, preset)
          } catch { /* best-effort */ }
        })
        .catch(() => { /* best-effort */ })
      return
    }
    playSynthesized(ctx, preset)
  } catch { /* best-effort */ }
}

// 页面内第一次手势就解锁音频：此后后台标签页由定时器触发也能出声。
if (typeof window !== 'undefined') {
  const onGesture = (): void => {
    unlockNotifySound()
    window.removeEventListener('pointerdown', onGesture)
    window.removeEventListener('keydown', onGesture)
  }
  window.addEventListener('pointerdown', onGesture, { passive: true })
  window.addEventListener('keydown', onGesture)
}
