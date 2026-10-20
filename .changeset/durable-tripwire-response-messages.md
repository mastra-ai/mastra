---
'@mastra/core': patch
---

Fixed durable and evented agents returning an empty `response.messages` when a `processOutputResult` processor rejects the final answer. `response.messages` now contains the assistant's draft, matching `text`, `steps` and the normal loop, so apps can still show the rejected reply to a reviewer.
