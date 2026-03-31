---
'@mastra/core': patch
'mastracode': patch
---

Tools that return objects with circular references no longer crash the agent with "Converting circular structure to JSON". Circular parts are replaced with `"[Circular]"` and the conversation continues normally.
