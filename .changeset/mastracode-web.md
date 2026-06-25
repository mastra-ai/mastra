---
'mastracode': minor
---

Add `mastracode web` — a browser UI for MastraCode served over HTTP.

`mastracode web` boots the real MastraCode Harness, registers it on a Mastra
instance, mounts the Harness HTTP routes (via `@mastra/server`) on a Hono
server, and serves a React UI built with Vite. The UI drives a session over the
`@mastra/client-js` harness resource (SSE event stream + JSON commands),
giving full feature parity with the TUI for the core interactive workflows:
chat streaming, tool execution, tool approvals, interactive suspensions
(ask_user / submit_plan / request_access), mode/model switching, thread
lifecycle, task tracking, goals, notifications, steer/abort, follow-ups, and
project-scoped workspaces with a server-driven directory picker.

The web server passes its storage to the parent Mastra and the registered
Harness inherits it, so TUI and web share the same durable threads and
observations for a given project (resourceId continuity).

Includes a scenario test suite that drives the production stack
(MastraClient → Hono → @mastra/server routes → Harness → AIMock) end to end.
