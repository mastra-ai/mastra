---
'mastracode': minor
---

Add a browser UI for MastraCode.

The web app boots the real MastraCode Harness, registers it on a Mastra
instance, mounts the Harness HTTP routes (via `@mastra/server`) on a Hono
server, and serves a React UI built with Vite. The UI drives a session over the
`@mastra/client-js` harness resource (SSE event stream + JSON commands) and
reaches feature parity with the terminal for the core interactive workflows:
chat streaming, tool execution, tool approvals, interactive suspensions
(`ask_user` / `submit_plan` / `request_access`), mode/model switching, thread
lifecycle, task tracking, goals, notifications, steer/abort, follow-ups, a
TUI-parity status line (message/reflection budgets and active-goal indicator),
and project-scoped workspaces with a server-driven directory picker.

A full Settings surface mirrors the terminal's configuration commands: model
selection, behavior (`yolo`, thinking level, notifications, smart editing,
per-category tool permissions), observational-memory models and thresholds,
model packs, API keys, and custom providers. These are backed by
`/api/web/config/*` routes that read and write the same global `settings.json`
the terminal uses, so configuration stays in sync across the terminal and the
browser.

The web server shares its storage with the registered Harness, and projects
resolve the same `resourceId` as the terminal, so the two share durable threads
and observations for a given project. Thread lists are scoped by project path so
worktrees that share a `resourceId` don't bleed each other's threads.

Internally, harness startup is shared through a single base factory with small
per-environment helpers, so the terminal app and the web server build the exact
same harness without duplicating wiring. The published `mastracode` package
remains terminal-only — the web UI lives in the repository for local
development and is excluded from the published package.

Includes a scenario test suite that drives the production stack
(`MastraClient` → Hono → `@mastra/server` routes → Harness → AIMock) end to end.
