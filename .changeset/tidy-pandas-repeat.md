---
'@mastra/core': patch
---

Fixed AI SDK v6/v7 message conversion throwing on reasoning parts with no text and no details, which could crash message rendering while a reasoning model streamed.
