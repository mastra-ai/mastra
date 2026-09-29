---
'@mastra/core': patch
---

`submit_plan` results now record the reviewer's decision. `submittedPlan.action` is `approved` or `rejected`, and `submittedPlan.feedback` holds the reviewer's comments when they asked for changes. UIs can show the outcome from message history without parsing the result text.
