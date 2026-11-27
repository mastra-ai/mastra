---
'@mastra/core': patch
---

Importer flushes now carry the full sequence item and the sequence's declaration. A `sequenceItem` takes `title`, `body`, `links`, `properties`, `type`, `externalParentId` (renamed from `threadExternalId`), and on a position sequence `position`, `after` or `before`; `occurredAt` and `body` are optional. A `declare` or `upsert` item can make its page a sequence with `sequence: { orderBy, propertiesSchema, itemTypes }`. The host checks the shape of these fields; the store checks content, limits and schemas when the item is applied.
