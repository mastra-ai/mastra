---
'@mastra/server': patch
---

Fixed Studio threads failing with `Gateway API error 404` for projects created with `create-mastra`. Agents using `mastra/` models with an organization (v2) Gateway key now read threads, messages, and observational memory from local storage, since the v2 Gateway does not serve the memory API.
