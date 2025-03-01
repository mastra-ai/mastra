---
'@mastra/memory': minor
'@mastra/core': minor
---

Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex
