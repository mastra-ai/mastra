---
'@mastra/factory': patch
---

A board tool rule that moves a work item back into its current stage with `reenter: true` now runs that stage's entry rules, as documented. Previously the entry rules were skipped, so no new agent run started.
