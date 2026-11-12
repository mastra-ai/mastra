---
'@mastra/factory': patch
---

Record a retryable `run_incomplete` failure when a Factory working-phase runner ends cleanly before the card progresses. Retry the incomplete delivery once, then show the terminal failure on the card instead of silently marking the decision successful.
