---
'@mastra/core': patch
---

Fixed AgentController sessions pausing every tool call for approval and running a step's tool calls one at a time. Fixes #30131.

- Calls to tools the session's permission rules allow no longer pause the run. Only calls that need approval wait on an approval prompt, and `deny` calls are still declined.
- Tool calls in one step run concurrently when none of them needs approval or can suspend. Durable agents still run them one at a time unless the session's `yolo` state is on.
- Answering `ask_user` no longer turns off approval for the rest of the run.
- On durable and evented agents, answering a suspended tool call from another thread now returns once the resumed run ends. It used to never return. Fixes #30150.
- Runs on a thread the session no longer has open use that thread's permission rules. `session.resolveToolApproval(toolName, scope)` accepts a run's `RequestContext` as `scope` for this.
- When a step runs its calls one at a time, a function `requireToolApproval` is evaluated for each call when it starts, so a rule changed by an earlier call or while the run waited for approval applies to the calls after it.
- A numeric `toolCallConcurrency` in an agent's `defaultOptions` is kept as the limit when a call passes `toolCallConcurrency` as an object, such as the `{ strategy: 'called' }` controller runs now use.

Allowed tools no longer emit `tool-call-approval` and `tool-call-resumed` chunks or store an approval on the tool part. Runs with `yolo` on already behaved this way.
