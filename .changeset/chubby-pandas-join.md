---
'@mastra/core': patch
---

Fixed workflows attached to durable agents never resuming after suspension. When a workflow used as an agent tool suspended (for example to ask the user a question), resuming a DurableAgent failed with "Failed workflow tool execution" and the workflow restarted from the beginning instead of continuing. The suspended workflow's run id is now preserved across suspension so the answer reaches the suspended step, matching the regular agent's behavior.
