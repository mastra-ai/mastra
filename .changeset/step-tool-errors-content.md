---
'@mastra/core': patch
---

Fixed failed tool calls missing from step results. When a model made several tool calls in one step, `content` in `onStepFinish` and `onFinish` steps kept only the last call. It now holds every `tool-call` followed by a `tool-result` or `tool-error` for each call, in call order, on every engine. Failed calls appear as `tool-error` parts with the error message, so you can pair them with `toolCalls`. `toolResults` still lists only successful calls.
