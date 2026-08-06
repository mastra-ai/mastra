---
'@mastra/factory': patch
---

Fixed autonomous GitHub factory-rule runs ignoring the factory's configured default model.

A run triggered by a factory rule started on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed the run outright with a missing-credentials error. Runs started from the board were unaffected, which is why this only appeared on autonomous runs. Rule-triggered runs now start on the project's configured model, matching runs started from the board.
