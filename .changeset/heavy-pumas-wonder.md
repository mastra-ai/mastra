---
'@mastra/core': patch
---

Fix `session.abort()` when a tool call is awaiting approval or parked in a suspension.

Aborting while a tool-approval gate was parked tore the agent-side run down before the gated call could be declined, so the abort surfaced a spurious `sendToolApproval() could not find an active or suspended run` error and the run ended with reason `error` instead of `aborted`. The abort now defers the stream teardown until the decline has been driven through the live run, and settles the gated call as `output-denied` so the display state no longer renders it as still in flight.

Aborting while tool suspensions were parked (e.g. `ask_user`, `request_access`) dropped them silently, leaving subscribers rendering prompts whose answers could never land. Each dropped suspension now emits `tool_suspension_cancelled`.
