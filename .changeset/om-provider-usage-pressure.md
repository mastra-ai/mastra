---
'@mastra/memory': patch
---

Fixed long reasoning-heavy runs outgrowing observational memory's token budget even when their message estimates stayed below it. Observation now also uses the previous step's provider-reported input and output usage, including cached input, with an estimate for newly added content. Compaction drops the old measurement; missing usage or a changed prompt falls back to message estimates. Messages the model has not read remain protected.
