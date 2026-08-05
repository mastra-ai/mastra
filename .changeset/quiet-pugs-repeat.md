---
'@mastra/core': patch
---

Fixed provider-executed tool errors being dropped when stream chunks are converted into assistant message history. `buildMessagesFromChunks` handled `tool-call` and `tool-result` but not the declared `tool-error` chunk, so a failed provider tool stayed in the pending `call` state with no error text. The matching invocation now becomes `output-error` with the normalized failure message. Fixes https://github.com/mastra-ai/mastra/issues/20715
