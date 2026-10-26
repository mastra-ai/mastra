---
'@mastra/factory': minor
---

The default Work board's Triage, Planning, Review and Done phases are now agents with a skill (`factory-triage`, `factory-plan`, `factory-review`, `factory-complete-issue`). Change a phase's skill in Settings → Boards to run your own skill there; Factory still decides when each runs, such as sending trusted pull requests straight to Review.
