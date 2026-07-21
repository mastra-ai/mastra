---
'@mastra/core': patch
---

Fixed fine-grained authorization (FGA) checks for `DurableAgent` execution and tool approvals.

**Durable agents now enforce `agents:execute`**

`DurableAgent` overrides `stream()` and `generate()` to run a workflow instead of the base agent path. Those methods now resolve default and per-call options once, then authorize the same effective actor, request context, and memory resource used for execution.

Behavior change: with an FGA provider configured, durable runs that were previously allowed through are now checked and can be denied.

**Durable resumes reauthorize each call**

Durable approval and decline methods now forward the trusted request context and selected tool-call ID into resume authorization and workflow resume. The actor is resolved for each call and forwarded to both agent authorization and tool execution. An explicit resume actor replaces the initial actor, while a newly resolved default actor can still apply. If neither exists, the resume uses normal user authorization and fails closed when no user is available.
