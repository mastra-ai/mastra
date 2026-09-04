---
'@mastra/factory': patch
---

Fix automated runs falsely failing when a plan agent handed a card straight on to Build. Decisions whose role was replaced on the session by the next role now complete instead of failing or retrying.
