---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed agents running Observational Memory twice when the observational memory processor is placed inside a processor workflow, including stored Editor processor graphs with a branch or parallel step. Memory now uses the processor you placed and does not add its own. Processor workflow steps created from a processor now keep that processor's id in `processorId`, even when the step id is renamed. Fixes [#31401](https://github.com/mastra-ai/mastra/issues/31401).
