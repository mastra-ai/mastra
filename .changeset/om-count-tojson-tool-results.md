---
'@mastra/memory': patch
---

Observational Memory now counts tool results that serialize through `toJSON()` (including `Date` values) by their serialized form, the same form that is stored and sent to the model. Previously such a result counted as an almost empty object, so observation could start later than its threshold.
