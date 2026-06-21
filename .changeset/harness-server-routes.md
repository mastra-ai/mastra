---
'@mastra/server': minor
'@mastra/core': minor
---

Expose Harness sessions over HTTP. When a Harness is registered on a Mastra instance (`new Mastra({ harnesses })`), the server now serves `harness:*` routes so non-terminal clients — e.g. a browser-based MastraCode — can create sessions, stream events, send messages, and drive run-control.

Routes (each scoped by `:harnessId` and a `:resourceId`-bound session, get-or-create so reconnects resume rather than fork):

- `GET /harness` — list hosted harnesses
- `POST /harness/:harnessId/sessions` — create or resume a session
- `GET /harness/:harnessId/sessions/:resourceId/stream` — SSE stream of the session's events
- `POST /harness/:harnessId/sessions/:resourceId/messages` — send a message (reply streams over SSE)
- `POST /harness/:harnessId/sessions/:resourceId/abort` — abort the in-flight run
- `POST /harness/:harnessId/sessions/:resourceId/tool-approval` — approve/decline a pending tool call

Adds a `harness` permission resource (`harness:read`, `harness:execute`) to the generated permission set.
