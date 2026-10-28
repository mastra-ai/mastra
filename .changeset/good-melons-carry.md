---
'@mastra/code-sdk': patch
---

Fixed saved thread-scope observation thresholds at or below 2,000 tokens stopping observational memory from starting. Resource scope still uses its saved threshold because it has no activation buffer.
