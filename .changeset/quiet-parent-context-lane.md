---
'@mastra/memory': patch
---

Deliver reminder parent context as a state signal that only costs tokens when it changes. The lane now sends per-candidate entries, so a check that changes one candidate sends one update instead of the whole projection, and a candidate whose knowledge node appears in the store's recent activity carries a marker naming that activity event.
