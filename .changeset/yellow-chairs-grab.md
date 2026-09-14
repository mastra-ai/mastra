---
'@mastra/core': patch
---

Fixed live agent scores being dropped when tracing is enabled. Durable agents now save scorer results, and scores link to the exported agent span instead of a hidden workflow step span. (#23465)
