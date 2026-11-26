---
'@mastra/duckdb': patch
---

Fixed DuckDB vector metadata filters so values are compared using their stored JSON type.

Previously a filter value was extracted as text and cast to a number, so `false` matched a stored `0`, `'0'` matched the number `0`, and range filters (`$gt`, `$gte`, `$lt`, `$lte`) errored on rows that held a boolean, string, null or array. The same clause builder also backs filtered updates and deletes, so those operations matched the wrong rows.

Now scalar equality (`$eq`, `$in`, `$nin`, `$contains`) checks the field's JSON type before comparing, and range filters only admit stored numbers. Booleans no longer match `0`/`1`, numeric strings no longer satisfy numeric filters, and a single query, update or delete clause is corrected for all of them.
