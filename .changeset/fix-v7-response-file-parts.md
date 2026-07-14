---
'@mastra/core': patch
---

Fixed generated files from AI SDK v7 models (e.g. gpt-image-1 image output) being corrupted in stream output and saved message history. The tagged V4 file data is now converted to the flat shape Mastra's stream pipeline and message storage expect.
