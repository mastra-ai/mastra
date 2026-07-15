---
'@mastra/core': patch
---

Fixed fine-grained authorization (FGA) checks for `DurableAgent` execution and tool approvals.

**Durable agents now enforce `agents:execute`**

`DurableAgent` overrides `stream()` and `generate()` to run a workflow instead of the base agent path. Those methods now resolve default and per-call options once, then authorize the same effective actor, request context, and memory resource used for execution.

Behavior change: with an FGA provider configured, durable runs that were previously allowed through are now checked and can be denied.

**Durable tool approvals preserve authorization context**

Durable approval and decline methods now forward the trusted request context and selected tool-call ID into resume authorization and workflow resume.
