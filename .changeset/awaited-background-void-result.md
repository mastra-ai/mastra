---
'@mastra/core': patch
---

Fixed awaited background tools that return nothing ending the agent turn early. A void result from a background tool called with the `awaited` disposition is now recorded as `null`, so the agent sends the result to the model and continues, matching regular tools that return nothing.
