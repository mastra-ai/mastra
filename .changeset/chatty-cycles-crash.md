---
'@mastra/memory': minor
'@mastra/core': minor
---

Memory system now uses processors. Memory processors (`MessageHistory`, `SemanticRecall`, `WorkingMemory`) are now exported from `@mastra/memory/processors` and automatically added to the agent pipeline based on your memory config. Core processors (`ToolCallFilter`, `TokenLimiter`) remain in `@mastra/core/processors`.
