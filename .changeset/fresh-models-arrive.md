---
'@mastra/playground-ui': patch
'@mastra/factory': patch
---

Factory model selectors can now accept a custom model ID when the deployed model catalog has not caught up with a newly released model. The shared combobox exposes this as opt-in behavior, leaving existing selectors unchanged.
