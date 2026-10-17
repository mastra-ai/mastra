---
'@mastra/core': patch
---

Classifier evaluation spans now record the classifier as their entity, so you can filter and group classifier traces in observability like agent and scorer traces. Each `classifier_evaluation` span sets `entityType: 'classifier'`, `entityId` and `entityName` to the classifier id. Spans without an explicit entity type fall back to `classifier` from the span type. Fixes #27325.
