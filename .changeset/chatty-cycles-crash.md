---
'@mastra/memory': minor
'@mastra/core': minor
---

Memory system now uses processors. Memory processors (`MessageHistory`, `SemanticRecall`, `WorkingMemory`) are automatically added to the agent pipeline based on your memory config, or you can add them manually for custom ordering. Import path changed from `@mastra/core/processors` to `@mastra/memory/processors`.
