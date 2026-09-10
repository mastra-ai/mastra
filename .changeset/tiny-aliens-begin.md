---
'@mastra/memory': patch
---

- Preserved caller thread identity in Observational Memory traces without assigning a session ID for other observability integrations.
- Preserved the supplied observability context when explicitly triggering asynchronous observation buffering.
