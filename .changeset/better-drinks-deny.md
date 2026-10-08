---
'@mastra/code-sdk': patch
---

Fixed DeepSeek models ignoring the thinking level. Requests now send the level the picker shows: Max on DeepSeek V4 Pro asks for maximum effort. Off turns thinking off instead of leaving DeepSeek on its default. The picker offers only the levels DeepSeek runs as distinct efforts, and Off only on models that can stop thinking.
