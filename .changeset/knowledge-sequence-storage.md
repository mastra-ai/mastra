---
'@mastra/core': patch
'@mastra/libsql': patch
---

Knowledge stores can now hold sequences: a page whose dated items, such as chat messages, deploys or build results, are stored as rows keyed by the source's own ID instead of one page per item. `store.sequences` marks a leaf page as a sequence and upserts items by `(sequenceId, externalId)`. An item has an optional one-line title, body, up to 10 http(s) links, JSON properties of up to 16 KB and a type such as `deploy`, and needs at least one of the first four. It can sit under another item of the same sequence, one level deep. Replaying an identical item changes nothing, and an older edit can't overwrite a newer one. Deletes are tombstones that clear the content, keep the type, and can't be brought back by a replay. Items are read newest or oldest first with a cursor, filtered by time range, parent item or type. Search matches titles, bodies, link titles and string property values. An item is visible only when its sequence page is live and readable. Items of a deleted sequence are purged in bounded batches. This covers the in-memory and LibSQL stores. Nothing writes sequences yet.
