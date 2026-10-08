---
'@mastra/code-sdk': patch
---

Fixed DeepSeek models ignoring the thinking level. Requests now send the level the picker shows, so Max on DeepSeek V4 Pro asks for maximum effort, and Off turns thinking off instead of leaving DeepSeek on its default. The picker offers Off only on DeepSeek models that can stop thinking.
