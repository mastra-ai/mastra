---
'@internal/playground': patch
---

Fixed Studio experiment lookups that only searched the 20 most recent runs. Filtering the experiments list by dataset now loads that dataset's runs directly, so older runs no longer disappear, and comparison links now carry the dataset id so older experiments resolve and the compare page survives a refresh. The compare URL is now `/experiments/compare?dataset=…&baseline=…&contender=…`.
