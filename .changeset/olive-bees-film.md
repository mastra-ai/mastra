---
'@mastra/core': patch
---

Fixed assistant messages to persist `content.metadata.modelId` during streaming.
This ensures stored and processed assistant messages keep the model identifier.
Developers can now reliably read `content.metadata.modelId` from downstream storage adapters and processors.
