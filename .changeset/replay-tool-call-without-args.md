---
'@mastra/core': patch
---

Fixed threads becoming unusable after a model sent a tool call with arguments that could not be parsed. That call was replayed to the model with no input, so OpenAI-compatible providers such as DeepSeek sent it without `arguments` and rejected every later request on the thread with "missing field `arguments`". The call is now replayed with an empty input.
