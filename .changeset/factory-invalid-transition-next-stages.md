---
'@mastra/factory': patch
---

Improved `invalid_transition` rejections. They now name the next stages declared from the current phase. An agent that requests a mistyped stage id can correct it in the same run.

Example: `The Delivery board does not allow moving from planning to plan_review. Next stages declared from planning: plan-review, canceled.`
