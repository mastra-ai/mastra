---
'@mastra/core': patch
---

Fixed interaction between savePerStep and observational memory that caused message duplication. The saveStepMessages method redundantly re-added response messages to the message list on every step, duplicating them. Additionally, savePerStep is now force-disabled when observational memory is enabled, since OM handles its own per-step persistence and the two features conflict.
