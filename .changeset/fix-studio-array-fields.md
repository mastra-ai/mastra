---
"@mastra/playground-ui": patch
---

Fixed Studio form crash when workflow input schemas contain `z.array()` fields with Zod v4. Array, union, and intersection fields now render and accept input correctly in the workflow run form.
