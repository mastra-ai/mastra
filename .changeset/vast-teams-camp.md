---
'@mastra/server': patch
---

Fixed /tools API endpoint crashing with provider-defined tools (e.g. `google.tools.googleSearch()`, `openai.tools.webSearch()`). These tools have a lazy `inputSchema` that is not a Zod schema, which caused `zodToJsonSchema` to throw `"Cannot read properties of undefined (reading 'typeName')"`.
