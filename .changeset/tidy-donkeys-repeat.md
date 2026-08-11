---
'@mastra/core': patch
'@mastra/memory': patch
---

Fix schema-based working memory losing stored data on partial updates. When a model updated one section of working memory, unrelated sections could be wiped out. Tools can now set `strict: false` to opt out of strict structured-output schema rewriting, which previously forced every field to be required and left models no way to signal "leave this field alone".
