---
'@mastra/core': patch
'@mastra/mcp': patch
---

Switch from serializing json schema string as a function to a library that creates a zod object in memory from the json schema. This reduces the errors we were seeing from zod schema code that could not be serialized.
