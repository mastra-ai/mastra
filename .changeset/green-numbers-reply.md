---
'@mastra/core': patch
---

Fixed data parts that an output processor writes with `writer.custom()` going missing from saved conversation history when the processor returns a copy of the messages it was given. The part now stays on the message whether the processor copied the messages before or after writing, so the stored thread and the next turn see the same parts the client saw. A part written during the call stays saved even if the returned copy leaves it out; use `transient: true` for parts that should only be streamed. Fixes #29822.
