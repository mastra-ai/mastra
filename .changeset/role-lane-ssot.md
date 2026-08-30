---
'@mastra/factory': patch
---

A Build run started from the board now credits the issue reporter the way the factory's own build dispatch always has.

The role→stage pairing and the reporter-credit instruction each lived twice — once in the rules, once re-typed in the board UI — and the UI copy of the credit had silently drifted to nothing. `FACTORY_ROLE_STAGES` and `reporterCredit` are now exported once from `@mastra/factory`; the board derives a run's landing lane from its role and appends the same `Co-Authored-By` instruction to board-started Build runs.
