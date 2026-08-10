---
'@mastra/core': patch
---

Fixed assistant message history so provider-executed tool failures are preserved instead of remaining as pending calls. Matching tool invocations now use `state: "output-error"`, and the normalized provider message is stored in `errorText` with a fallback when no usable message is available. Fixes https://github.com/mastra-ai/mastra/issues/20715
