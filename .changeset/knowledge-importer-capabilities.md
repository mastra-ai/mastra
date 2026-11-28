---
'@mastra/core': patch
---

Importer hosts now say what they accept when a run starts: `capabilities: { contract: 2, sequences }`. Importer flushes can carry `sequenceItem` and `removeSequenceItem` ops. A host without sequences refuses the whole flush with the new `unsupported` conflict code, so none of its pages or state are applied. The built-in host doesn't take sequences yet.
