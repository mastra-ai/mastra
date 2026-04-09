---
'@mastra/core': patch
---

Fixed OpenAI reasoning summary streaming so live gpt-5.4 runs keep reasoning delta content instead of dropping it when multiple summaries overlap or finish out of order.
