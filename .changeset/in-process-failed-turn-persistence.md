---
'@mastra/core': patch
---

Failed turns on the default Agent now save the same history as durable agents.

- A reply that fails mid-stream keeps the text streamed so far, followed by the error, instead of only the error.
- When an input processor throws, the user message and the error are saved to memory, and the stream ends with an `error` chunk instead of the run failing with nothing saved.
