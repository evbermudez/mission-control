# Mission Control

A tiny localhost dashboard for solo dev work on Archimedes. Surfaces:

- **Branches** — local branches with ahead/behind counts vs `origin/staging` and `origin/main`.
- **My open PRs** — via `gh pr list --author @me`, with CI status.
- **Codex jobs** — running and recent jobs from the Codex companion.
- **Quick actions** — click to copy `/claudemd-review`, `/codex:claudemd-review`, etc. Paste into Claude Code yourself.

No daemon, no execution from the browser. Just read-only signals plus clipboard helpers.

## Setup

```bash
cd ~/Projects/mission-control
cp .env.example .env       # edit MC_REPO_PATH if needed
bun install
bun run dev
```

Open http://localhost:5173.

## Requirements

- [Bun](https://bun.sh) (or Node 20+).
- [`gh`](https://cli.github.com) authenticated (`gh auth login`).
- [Codex companion plugin](https://github.com/openai/codex) installed under `~/.claude/plugins/cache/openai-codex/codex/<version>/` (optional — jobs card gracefully degrades if missing).

## Config

| Var | Required | Default |
|---|---|---|
| `MC_REPO_PATH` | yes | — |
| `MC_CODEX_COMPANION` | no | auto-detects latest version in `~/.claude/plugins/cache/openai-codex/codex/` |

## Architecture

Single Vite process. The API lives as a Vite plugin (`server/setup-api.ts`) that registers `/api/*` middleware on Vite's dev server. Each endpoint shells out to whitelisted commands (`git`, `gh`, the codex companion) with `cwd = MC_REPO_PATH`.

```
mission-control/
├── server/
│   └── setup-api.ts        # all /api/* endpoints
├── src/
│   ├── App.tsx             # 4-card layout
│   ├── lib/
│   │   ├── api.ts          # typed fetch wrappers
│   │   └── format.ts       # ahead/behind labels, time-since, clipboard
│   └── components/
│       ├── BranchesCard.tsx
│       ├── PrsCard.tsx
│       ├── CodexJobsCard.tsx
│       └── QuickActionsCard.tsx
└── vite.config.ts
```

## What's intentionally not here

- Auth (localhost-only, single user).
- Database (every refresh re-shells; no state).
- "Execute" buttons that run AI reviews (would need a Claude Code daemon; keeps conversation context broken). Clipboard-and-paste is the safe pattern.
- Deploy state / tenant health (deferred until v1 proves useful).
