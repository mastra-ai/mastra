---
'@mastra/memory': patch
---

**Fixed out-of-order observations**

Observational memory now keeps observations in the order events happened. Before, an important user message could be listed ahead of earlier events from the same period, so an outdated state looked like the latest one. For example, a "plan not approved, wait for revision instructions" result could be recorded after the user's actual revision instructions, and the agent kept waiting for instructions it already had.
