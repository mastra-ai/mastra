---
'@mastra/core': patch
'@mastra/client-js': patch
---

Classifier evaluation traces now record the classifier as their entity, so they show the classifier name on the Traces page instead of "(not set)" and can be filtered and grouped like agents, workflows and scorers. `EntityType` gains a `classifier` value.
