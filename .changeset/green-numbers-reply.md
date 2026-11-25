---
'@mastra/core': patch
---

Fixed data parts that an output processor writes with `writer.custom()` going missing from saved conversation history when the processor returns a copy of the messages it was given. The part now stays on the message whether the processor copied the messages before or after writing, so the next turn and the stored thread see the same parts the client saw. Fixes #29822.
