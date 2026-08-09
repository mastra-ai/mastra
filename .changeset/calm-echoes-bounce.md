---
'@mastra/core': patch
---

Fix client-echoed message history silently overwriting canonical stored messages. When a client submits its visible transcript back on a later turn, previously-persisted messages are now reconciled against the stored record by ID (instead of the recall window): unchanged echoes are no longer re-persisted, and only supported client-authored transitions — such as a client-side tool result advancing a stored `call` to `result` — are merged into the stored version, preserving output-processor transformations, tool history, and server-authored metadata. Fixes [#20836](https://github.com/mastra-ai/mastra/issues/20836).
