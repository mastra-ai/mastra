---
'@mastra/memory': patch
---

Fix working memory data corruption when using resource scope across threads

- Add mutex protection to `updateWorkingMemory()` to prevent race conditions during concurrent updates
- Add normalized whitespace comparison to `__experimental_updateWorkingMemoryVNext()` to detect template duplicates with whitespace variations
- Add validation to `updateWorkingMemoryTool` to prevent LLM from accidentally wiping existing data by sending empty template
- Improve template removal logic to handle line ending variations
