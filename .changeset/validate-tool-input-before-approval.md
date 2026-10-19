---
'@mastra/core': patch
---

Tools that require approval now validate their input before asking for approval. Previously an agent asked a person to approve a call whose arguments did not match the tool's `inputSchema`, and the call then failed validation after it was approved. Now the validation error goes straight back to the model so it can retry, and no `tool-call-approval` is emitted. This applies to `Agent`, durable agents, and agent networks. Fixes #26771.
