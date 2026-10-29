---
'@mastra/core': patch
---

Fixed client tool results being dropped when `workingMemory.useStateSignals` stored the previous response as several rows. A result sent back with the next message, or on its own, now completes the stored tool call and stays in later prompts. Fixes [#28258](https://github.com/mastra-ai/mastra/issues/28258).
