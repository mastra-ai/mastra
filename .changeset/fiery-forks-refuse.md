---
'@mastra/core': patch
---

Fixed OpenAI reasoning models (e.g. gpt-5.2) failing with "function*call was provided without its required reasoning item" when reasoning and tool-call parts are stored as separate messages in memory. The previous fix only detected OpenAI metadata when reasoning parts existed in the same message, missing cases where reasoning was already stripped but tool parts still carried `fc*\*` item IDs.
