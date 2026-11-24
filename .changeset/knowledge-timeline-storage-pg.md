---
'@mastra/pg': patch
---

PostgreSQL Knowledge stores can now hold timelines, with the same behaviour as the in-memory and LibSQL stores: entries upserted by the source's own ID, tombstoned deletes, newest- or oldest-first reads by cursor, time range or thread, visibility through the live timeline page, and purge of deleted timelines in bounded batches. Writers to one timeline are serialized with a row lock. Nothing writes timelines yet.
