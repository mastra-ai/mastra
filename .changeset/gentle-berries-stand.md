---
'@mastra/factory': patch
'mastra': patch
---

The board catalog now marks the project's default board with `default: true` and lists, per board, the phase that plays each part of the pull request loop under `flow` (`triage`, `build`, `buildContext`, `selfReview`, `pullRequestReview`, `completed`, `canceled`). The Factory board reads these, so a custom board with a pull request loop offers the same Investigate, Plan, Build and Review moves and triage decisions as Work, under its own phase names. A board that doesn't build no longer treats its first working phase as triage.
