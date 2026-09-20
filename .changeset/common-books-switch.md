---
'@mastra/connect': minor
---

Added a 'scopes' option to knowledge importer integrations: pass a function returning scope addresses (for example one per active project) and the importer syncs into that live set on every run, alongside any static scopes from the access map. The resolver receives the importer's platform connection, so different connections of the same provider can resolve different destination sets (per-connection routing).
