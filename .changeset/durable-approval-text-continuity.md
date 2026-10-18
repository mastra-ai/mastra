---
'@mastra/core': patch
---

Fixed `DurableAgent` and evented agents dropping the text a model streamed before a tool approval. After `approveToolCall()`, the resumed stream's `text` and `steps` now include that earlier text, the same as a plain `Agent`. The suspended stream's `text`, `steps` and `finishReason` (`'suspended'`) now resolve instead of hanging.
