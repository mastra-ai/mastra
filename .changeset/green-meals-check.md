---
'@mastra/server': minor
---

Improved the response type of the agent controller observational memory route. The route previously described its record as an unknown value, so clients had no type information for it. It now reuses the existing observational memory record schema, giving the endpoint the same typed shape as the other memory routes.
