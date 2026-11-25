---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed agents running Observational Memory twice when the observational memory processor is placed inside a processor workflow, including stored Editor processor graphs with a branch or parallel step. Memory now uses the processor you placed and does not add its own. Fixes [#31401](https://github.com/mastra-ai/mastra/issues/31401).

Steps created from a processor now keep that processor's id in a new optional `processorId` field, also after `cloneStep` or an Editor graph renames the step. Upgrade `@mastra/core` together with `@mastra/memory` to get the fix for Editor graphs and cloned steps.
