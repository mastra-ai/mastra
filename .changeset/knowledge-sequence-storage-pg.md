---
'@mastra/pg': patch
---

PostgreSQL Knowledge stores can now hold sequences, with the same behaviour as the in-memory and LibSQL stores: items with a title, body, links, properties and type, upserted by the source's own ID, tombstoned deletes, time or position order, property schemas and item types, child pages kept in step as page items, reads in either direction by cursor, time range, parent item or type, visibility through the live sequence page, and purge of deleted sequences in bounded batches. Writers to one sequence are serialized with a row lock. Nothing writes sequences yet.
