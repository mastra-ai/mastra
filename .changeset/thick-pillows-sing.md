---
'@mastra/factory': patch
---

Fixed rule-triggered factory sessions ignoring the project default model. Sessions created by stage-transition rules now correctly use the project's configured default model instead of falling back to the controller default.
