---
'@mastra/core': patch
---

Fixed three cases where a durable agent's stream, or a regular agent's saved approval metadata, did not match what the stream reported.

- Tool result chunks now include `providerExecuted`, which tells the caller whether the tool ran on the provider's side. It was missing on durable runs, so clients received `undefined` where regular agents report the value.
- Approval requests on durable agents now publish the same `resumeSchema` as regular agents, including `$schema`, `additionalProperties: false` and the field descriptions. The accepted resume data is unchanged.
- Approval metadata saved by regular agents now carries the same `resumeSchema` as the live approval request, including the optional `reason` field the saved copy was missing. The accepted resume data is unchanged.
