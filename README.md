# Mission Control

A tiny localhost dashboard for solo dev work on Archimedes. Surfaces:

- **Branches** — local branches with ahead/behind counts vs `origin/staging` and `origin/main`.
- **My open PRs** — open PRs authored by you, with CI status and merge target branch.
- **Codex jobs** — running and recent jobs from the Codex companion.
- **Quick actions** — click to copy `/claudemd-review`, `/codex:claudemd-review`, etc. Paste into Claude Code yourself.
- **Review loop** — copy the AGENTS.md review/fix-loop prompts, or opt in to launching whitelisted Codex companion jobs.
- **Archimedes Vault** — recent ticket scopes, delivered batches, and safe project-knowledge shortcuts.

By default there is no execution from the browser. Prompt-run buttons are disabled unless `MC_ENABLE_PROMPT_RUNS=1` is set.

<img width="3456" height="2190" alt="image" src="https://github.com/user-attachments/assets/350fc4e3-4d6a-4cd8-9ecb-0d16564185c2" />

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
| `MC_ARCHIMEDES_VAULT_PATH` | no | `~/Documents/Obsidian Vault/Archimedes` |
| `MC_CODEX_COMPANION` | no | auto-detects latest version in `~/.claude/plugins/cache/openai-codex/codex/` |
| `MC_ENABLE_PROMPT_RUNS` | no | unset; copy-safe mode |
| `MC_REVIEW_BASE` | no | `origin/staging` |

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

## Review Automation

Mission Control can now support the Codex + Claude review loop without removing the current branch, PR, or job views:

1. Keep using **My open PRs** and **Branches** for visibility.
2. Use **Review loop** to copy `/codex:claudemd-review --background --base origin/staging`.
3. Set `MC_ENABLE_PROMPT_RUNS=1` if you want the **run** buttons to launch whitelisted Codex companion jobs directly.
4. Use the fix-loop action after a review produces hard violations, soft violations, or nits. It asks Codex to fix in scope, verify, stage intended files, generate a caveman-style commit, commit, push, and provide the next review command.
5. Repeat until the review has no hard violations, no remaining nits, and remaining soft violations are documented PR notes.
6. Once the loop is clean, run the Archimedes `pr-summary-format` skill to produce or update the PR body.

The server does not accept arbitrary shell commands from the browser. It only dispatches predefined Codex companion actions.

## What's intentionally not here

- Auth (localhost-only, single user).
- Database (every refresh re-shells; no state).
- Arbitrary shell execution from the browser.
- Deploy state / tenant health (deferred until v1 proves useful).
