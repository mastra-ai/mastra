---
'@mastra/evals': patch
---

Fixed faithfulness scorer failing with 'expected record, received array' error when used with live agents. The preprocess step now returns claims as an object instead of a raw array, matching the expected storage schema.
