---
'@mastra/core': patch
---

Fixed channel replies (e.g. Slack) being split into one message per citation when a model emits several text blocks in a single step, such as Anthropic web search results. Text blocks within a step are now posted together as one message.
