---
'@mastra/core': minor
'mastracode': patch
---

A Harness registered on a Mastra now inherits that Mastra's storage when it has no `config.storage` of its own.

Previously `__registerMastra` only shared the parent Mastra's agents, gateways, and observability — every storage operation (threads, messages, OM, memory) still read `harness.config.storage` directly, so a harness with no storage of its own persisted nothing even when registered on a Mastra that had storage configured.

Storage resolution is now `config.storage ?? parentMastra.getStorage()`. An explicit `config.storage` still wins (standalone harnesses, e.g. the terminal app, are unchanged); a registered harness with no local storage falls back to the parent. This lets a server own durability once on the Mastra and have every harness it hosts share it.

`mastracode web` uses this: the web server hands its storage to `new Mastra({ harnesses, storage })`, so the served harness persists threads durably instead of falling back to in-memory.
