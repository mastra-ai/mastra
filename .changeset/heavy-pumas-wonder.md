---
'@mastra/core': patch
---

Fixed `session.abort()` when a tool call is waiting on approval or parked in a suspension.

Aborting from a `tool_approval_required` subscriber raised an error and ended the run with reason `error`. It now completes with reason `aborted`, and the gated call settles as `output-denied` instead of rendering as still in flight.

Aborting while tool suspensions were parked (`ask_user`, `request_access`) dropped them silently, leaving prompts on screen whose answers could never be delivered. Each dropped suspension now emits `tool_suspension_cancelled`. Fixes #20592
