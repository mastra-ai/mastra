---
'@mastra/core': patch
---

Move the Harness agent run engine onto the Session. The stream loop that consumes an agent's event stream — folding chunks into display messages and token usage, driving tool approval/suspension, and finalizing the run — now lives in a per-session `SessionRunEngine` owned by the Session and driven through the injected `SessionMachinery`. The pure chunk→message content transforms move to a shared `stream-content` module.

In the multi-user host the run loop, run state, and thread stream are per-session and cannot be shared, so they belong on the Session; how a run is produced (agent + config-backed builders) stays Harness-owned machinery. Behavior is unchanged: `harness.session.processStream(...)` and `session.resolveToolApproval(...)` replace the previously Harness-private equivalents.
