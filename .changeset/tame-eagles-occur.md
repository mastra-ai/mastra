---
'@mastra/core': patch
---

Fixed semantic recall running messages from other conversations together on a single line. Each recalled message now appears on its own line in the system prompt, so the model can tell where one message ends and the next begins.
