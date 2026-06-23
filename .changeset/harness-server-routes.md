---
'@mastra/server': minor
'@mastra/core': patch
---

Expose Harness sessions over HTTP.

Adds a set of `harness`-scoped server routes that let a registered Harness be
driven over HTTP: create (get-or-create) a session by `resourceId`, send
messages, steer, abort, approve/decline tool calls, respond to tool
suspensions, switch mode/model, manage threads, read session state, and
subscribe to the session's event stream via SSE. Routes resolve the target
Harness through `mastra.getHarness(id)` and operate on the session returned by
`harness.createSession(...)`.

A new `harness` permission resource is included (`harness:read`,
`harness:execute`).
