---
'@mastra/code-sdk': patch
---

Fixed DeepSeek models ignoring the thinking level. Requests now send the reasoning effort the model runs, so Max on DeepSeek V4 Pro asks for maximum effort, and Off turns thinking off instead of leaving DeepSeek on its default.
