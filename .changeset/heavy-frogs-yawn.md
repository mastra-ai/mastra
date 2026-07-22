---
'@mastra/factory': patch
---

Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window.
