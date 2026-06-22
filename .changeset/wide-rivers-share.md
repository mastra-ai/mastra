---
'mastracode': minor
---

Add a built-in web UI to MastraCode. `mastracode web` boots the same production Harness the terminal uses, registers it on a Mastra instance, and serves the harness HTTP routes plus a React chat UI over a Node Hono server. Each browser client gets its own isolated session via the harness routes, so one server can drive many concurrent users.

The web UI lives in `mastracode/web/` and shares the run-control surface, transcript event modeling, and session state with the TUI instead of duplicating them. The previous standalone `examples/mastra-code-react` proof-of-concept (which rebuilt a toy Harness) has been removed in favor of this first-class command.

Run it locally with `pnpm --filter mastracode web:dev` (Vite UI + API server side by side) or `mastracode web` against a built UI.
