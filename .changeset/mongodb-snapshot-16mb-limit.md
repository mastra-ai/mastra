---
'@mastra/mongodb': patch
---

Fixed MongoDB 16MB document limit crash for long workflow and agent runs by adding transparent `zlib` snapshot compression.

Resolves https://github.com/mastra-ai/mastra/issues/21412
