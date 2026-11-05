---
'@mastra/core': patch
---

Fixed an extra model request after a response that ended on the output limit or a content filter. When such a response contained a tool call that failed, the agent asked the model again and the run finished as `stop`. A failed call can be one whose arguments were cut off and could not be parsed, a call to an unknown tool, or a tool that threw. The run now ends with the original `length` or `content-filter` finish reason, and the error is still recorded as the call's result. A call with unparseable arguments never runs. Failed calls in other responses still send the error back so the model can correct them. Fixes [#29518](https://github.com/mastra-ai/mastra/issues/29518).
