---
'@mastra/memory': patch
---

Observational Memory spends less CPU saving token counts for stored history on large threads. It now compares each stored part with the counted part field by field instead of serializing both to JSON. The comparison also ignores object key order, so a store that reorders keys (such as Postgres `jsonb`) still gets its counts saved.
