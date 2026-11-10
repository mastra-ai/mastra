---
'@mastra/core': patch
---

Answering the same suspended tool call twice at once now resumes the run only once. A duplicate answer is ignored instead of failing with "another resume of it already claimed it", so followers no longer get a false failure. A resume that fails because the run is gone still reports the error and keeps the prompt open. The new `session.isAnsweringToolCall(toolCallId)` tells you when an answer to a call is already on its way.
