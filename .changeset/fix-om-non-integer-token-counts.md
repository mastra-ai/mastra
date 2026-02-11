---
'@mastra/memory': patch
'@mastra/pg': patch
---

Fixed observational memory computing non-integer token counts, which caused `invalid input syntax for type integer` errors when writing to PostgreSQL. The root cause was `TOKENS_PER_MESSAGE = 3.8` producing fractional values. Token counts are now rounded at the source and defensively before all integer column writes.
