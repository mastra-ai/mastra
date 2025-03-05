---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
