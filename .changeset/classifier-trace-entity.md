---
'@mastra/core': patch
'@mastra/client-js': patch
---

Classifier traces are now attributed to the classifier that ran them. The root span from `Classifier.decide()` now sets `entityType: 'classifier'`, `entityId` and `entityName`, so these traces no longer show "(not set)" and can be filtered and grouped by entity. `EntityType` gains a `CLASSIFIER` value.
