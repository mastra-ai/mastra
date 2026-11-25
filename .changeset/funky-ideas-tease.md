---
'@mastra/memory': patch
---

Fixed agents running Observational Memory twice when the observational memory processor is placed inside a processor workflow (for example a stored processor graph with a branch or parallel step). Memory now uses the processor you placed and does not add its own. Fixes [#31401](https://github.com/mastra-ai/mastra/issues/31401).
