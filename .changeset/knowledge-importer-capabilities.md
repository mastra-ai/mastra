---
'@mastra/core': patch
---

Importer hosts now say what they accept when a run starts: `capabilities: { contract: 2, timelines }`. Importer flushes can carry timeline `entry` and `removeEntry` ops. A host without timelines refuses the whole flush with the new `unsupported` conflict code, so none of its pages or state are applied. The built-in host doesn't take timelines yet.
