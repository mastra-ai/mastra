---
'@mastra/core': patch
---

Fixed working memory tools being injected when no thread context is provided. Previously, calling agent.stream() without memory options on an agent with workingMemory enabled would cause a runtime error if the model called the updateWorkingMemory tool.
