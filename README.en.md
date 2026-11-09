# dsh-memory-evolve

> **Long-term memory, self-evolving skills, todo management and multi-agent collaboration for DeepSeek Harness.**

[简体中文](./README.md) · **English** · [Usage guide](./docs/USAGE.en.md) · [Detailed docs (中文)](./README-详细说明.md) · [Changelog](./docs/CHANGELOG.en.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](./package.json)

---

## What it is

`dsh-memory-evolve` is a full-featured plugin (host + web client) for [DeepSeek Harness](https://github.com/deepseek-ai/dsh). It adds three things:

1. **Memory** — layered, cross-session, archivable long-term memory;
2. **Evolution** — turn experience into reusable skills;
3. **Collaboration** — session broadcast, COI dispatch, and external AI CLI orchestration.

Most capabilities are opt-in from **Memory Evolve Settings** and stay out of the model's tool list until enabled.

![Memory tab](docs/记忆tab.png)

## Features

| Module | Capability |
| --- | --- |
| **Layered memory** | User profile / global facts / project key memory / project log / daily log; project memory can be scoped to a git branch; over-budget entries degrade to index lines |
| **Self-evolution** | Distil experience from conversations and create reusable skills |
| **Todos** | Four tracks (project / work / life / daily), Eisenhower quadrants, due dates, status flow |
| **COI dispatch** | One dispatcher for kimi / codex / grok / hermes and other external AI CLIs |
| **Session broadcast** | Message other DSH sessions, with rooms, presence and image attachments |
| **Canvas** | Pin files, text, images and media onto an infinite pannable board |
| **Prompts** | Prompt library and injection, enabled per scenario |
| **Memory sync** | Share project memory across machines over git (conflict merge, identity isolation) |
| **WebUI** | Settings, memory queue, notification bell, bookmarks, session review, Mermaid rendering |

More screenshots in the [usage guide](./docs/USAGE.en.md).

## Install

```sh
# From GitHub
dsh plugin --profile web add github:xiaohuo130/dsh-memory-evolve

# Or local development
git clone https://github.com/xiaohuo130/dsh-memory-evolve
dsh plugin --profile web add ./dsh-memory-evolve
```

Bundles are assembled at **startup**: restart DSH afterwards and refresh the page.

> Install through the standard DSH plugin path (profile `node_modules`). Do **not** hand-edit the profile's `package.json` or `cordis.patch.yml`.

## Quick start

1. Open any session — extra tabs appear: **Memory / Skills / Todos / COI / Broadcast / Canvas / Prompts / Sync**;
2. Open **Memory Evolve Settings** and enable what you need;
3. Just chat — progress is written to the project and daily logs every turn;
4. To persist a decision, say "**remember: ...**"; it asks for confirmation before writing project key memory.

Full workflow: [usage guide](./docs/USAGE.en.md).

## Build

`lib/client.js` is a **pre-built artefact** — installing does not require a build.

To change the web client:

```sh
# esbuild is resolved from a DSH source checkout
export DSH_SOURCE=/path/to/dsh-checkout
node scripts/build.mjs      # writes lib/client.js
```

The build script backs up the previous `lib/client.js` to `lib/client.js.bak-build-<timestamp>`.

## Test

```sh
node --test 'tests/*.test.js'   # Node >= 20
```

Covers memory storage, sync, broadcast, COI dispatch, todos, skills, bookmarks, notifications and WebUI APIs.

> **Test status**: the suite was written on macOS. On Windows, 52 of 729 cases fail for platform-specific reasons — path separators (`D:\w\a.js` vs `/w/a.js`), `/Volumes` and `mdfind` probes, and scenarios that need a real git repository. These failures predate the public-release clean-up and are not regressions.

## Layout

```
.
├── lib/                 # host runtime + pre-built client bundle
├── src/client/          # web client sources (TS/TSX)
├── scripts/             # build and worker scripts
├── skills/              # bundled skill templates
├── tests/               # node:test suite
├── docs/                # guides, screenshots, changelog
└── vendor/              # mermaid engine (served on demand from /memory-evolve/mermaid/)
```

## Compatibility

- Requires DSH `tools` / `systemPrompt` / web client runtime (verified on 0.1.x and 0.2.x).
- Pure ESM; **zero host runtime dependencies**; frontend deps are bundled into `lib/client.js`.
- Node.js >= 20.

## Docs

- [Usage guide (English)](./docs/USAGE.en.md)
- [使用指南（中文）](./docs/使用指南.md)
- [Detailed docs (中文)](./README-详细说明.md)
- [Memory sync](./docs/记忆同步.md)
- [Changelog](./docs/CHANGELOG.en.md)

## Contributing

Issues and PRs are welcome. Before submitting, make sure `node --test 'tests/*.test.js'` passes; when changing the frontend, commit both `src/` and the rebuilt `lib/client.js`.

## License

[MIT](./LICENSE)
