---
'@mastra/pg': patch
---

Improved PostgresStore last-N message reads. Paginated reads now avoid materializing message content for every matching row before applying the page limit, letting the `(thread_id, createdAt DESC)` index serve the page. Totals and single-round-trip behavior remain unchanged.
