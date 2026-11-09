---
'@mastra/factory': minor
---

The board catalog now lists, per board, the phase that plays each part of the pull request loop under `flow` (`triage`, `build`, `selfReview`, `pullRequestReview`, `completed`, `canceled`). The Factory board reads these, so a custom board with a pull request loop offers the same Investigate, Plan, Build and Review moves and triage decisions as Work, under its own phase names. A board that doesn't build no longer treats its first working phase as triage.

```json
{
  "id": "ship",
  "initialPhase": "inbox",
  "flow": {
    "triage": "think",
    "build": "make",
    "pullRequestReview": "pr",
    "completed": "shipped",
    "canceled": "dropped"
  }
}
```

Against a server older than `flow`, the Factory board reads Work and the retired Review board by their old phase keys, as that server did.
