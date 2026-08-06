---
'@mastra/core': patch
---

Coerce string-typed maxSteps in sub-agent delegation tool to number. LLMs frequently emit tool arguments as strings even for numeric fields — the sub-agent input schema now accepts both and converts.
