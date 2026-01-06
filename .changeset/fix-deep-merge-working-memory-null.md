---
'@mastra/memory': patch
---

Fix deepMergeWorkingMemory crashing when LLM calls updateWorkingMemory with empty object. The function now handles null/undefined/empty updates gracefully by preserving existing data.
