---
'@mastra/memory': patch
---

Observational Memory spends less CPU formatting dates and saving token counts on large threads. It now builds each date formatter once instead of once per message line, which takes formatting 2,000 Observer message lines from about 130ms to about 6ms with the same output. When it saves token counts for stored history, it now compares each stored part with the counted part directly instead of serializing both to JSON. That comparison also ignores object key order, so a store that reorders keys (such as Postgres `jsonb`) still gets its counts saved.
