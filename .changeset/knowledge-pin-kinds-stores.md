---
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mysql': minor
'@mastra/mongodb': minor
---

Store Knowledge listing pins. The pins table gets a `kind` column (`page` or `list`) and a `depth` column, and a page now holds one pin per kind. Existing pins become page pins; no reset is needed.

**Migration step on first start.** Each store upgrades its pins table once, the first time it starts with this version:

- LibSQL rebuilds the pins table (SQLite can't drop the old one-pin-per-page constraint in place): it creates the new table, copies every pin across as a page pin, and swaps it in, inside the init transaction.
- Postgres and MySQL alter the table in place (add `kind` and `depth`, replace the unique key on the page with one on page and kind).
- MongoDB sets `kind: 'page'` on existing pins and replaces the unique index on `pageId` with one on `pageId` and `kind`.
