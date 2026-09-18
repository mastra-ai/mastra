---
'@mastra/memory': patch
---

Observational memory now runs when your agent uses a Mastra gateway model. It used to switch itself off, because the gateway ran observation on its own. The gateway no longer does, so a locally configured Memory would silently do nothing.
