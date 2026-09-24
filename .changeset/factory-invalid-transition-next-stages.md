---
'@mastra/factory': patch
---

`invalid_transition` rejections now name the next stages declared from the current phase, so an agent that requests a mistyped stage id can correct it in the same run. For example: `The Delivery board does not allow moving from planning to plan_review. Next stages declared from planning: plan-review, canceled.`
