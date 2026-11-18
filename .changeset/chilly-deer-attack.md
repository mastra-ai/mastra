---
'@mastra/core': patch
---

Fixed storage logs ignoring the Mastra logger. `new Mastra({ logger })`, `logger: false` and `mastra.setLogger()` now reach each domain inside a storage adapter (memory, workflows, schedules and the rest), not only the top-level store, and storage attached later with `mastra.setStorage()` uses the same logger. Before, those domains kept printing to the console with their own default logger. Domain logs from every storage adapter now follow the Mastra logger and its level, so you may see storage warnings that were hidden before. Fixes [#29885](https://github.com/mastra-ai/mastra/issues/29885).
