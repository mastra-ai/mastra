---
'@mastra/core': patch
---

Fixed an extra model request when a tool call failed in a response that hit the output limit or a content filter. The run now ends with that `length` or `content-filter` finish reason instead of `stop`, and the tool error is kept as the call's result. A call whose arguments were cut off never runs. When a tool call fails in any other response, the model still gets the error and can try again. Fixes [#29518](https://github.com/mastra-ai/mastra/issues/29518).
