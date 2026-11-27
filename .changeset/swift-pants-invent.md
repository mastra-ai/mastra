---
'@mastra/core': patch
---

Fixed a tool call being dropped when a model reuses a tool call id in a later step of the same run (https://github.com/mastra-ai/mastra/issues/31609). Gateways that number tool calls per response reuse `call_0` for the first call of every step, so the second call was merged onto the first, finished invocation: it never reached the message list and its result overwrote the first call's result. Both calls and both results now reach the model.
