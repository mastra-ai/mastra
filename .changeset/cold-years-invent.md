---
'@mastra/core': patch
---

Fixed agents failing for good when a provider rejects a file or image in a tool result (for example an image whose bytes do not match its type). The rejected part is now replaced with a short note in the conversation history and the model is called once more, instead of every later call failing with the same error.
