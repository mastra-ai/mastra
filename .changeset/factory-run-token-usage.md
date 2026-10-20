---
'@mastra/factory': patch
---

Factory now records the token usage of each run on its `factory.run.ended` audit event, alongside the run's role and kickoff. The event carries the run's totals and its per-step usage, including steps from turns that were suspended and resumed. A run with no reported usage is marked `unreported`, so it no longer looks like zero spend. If the end event can't be saved, Factory logs a warning and keeps the usage for the retry instead of dropping it.
