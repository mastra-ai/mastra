---
'@mastra/clickhouse': patch
---

Fixed ClickHouse deleteMessages bumping thread updatedAt with an ALTER TABLE UPDATE mutation, which rewrote whole data parts (often forbidden on managed deployments) and stamped the same updatedAt on every stored version of the thread row — making thread reads ambiguous on the ReplacingMergeTree until parts merged, so a just-renamed or archived thread could read back its previous state. The timestamp bump now inserts a strictly newer thread version, like every other thread write. Fixes #25580
