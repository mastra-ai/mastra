---
'@mastra/core': patch
---

Fixed two cases where a durable agent's stream did not match a regular agent's stream.

- Tool result chunks now include `providerExecuted`, which tells the caller whether the tool ran on the provider's side. It was missing on durable runs, so clients received `undefined` where regular agents report the value.
- Approval requests on durable agents now publish the same `resumeSchema` as regular agents, including `$schema`, `additionalProperties: false` and the field descriptions. The accepted resume data is unchanged.
