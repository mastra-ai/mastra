---
'@mastra/core': patch
---

Fixed stream freezing when using Anthropic's Programmatic Tool Calling (PTC). Streams that contain only tool-input streaming chunks (without explicit tool-call chunks) now correctly synthesize tool-call events and complete without hanging. See [#12390](https://github.com/mastra-ai/mastra/issues/12390).
