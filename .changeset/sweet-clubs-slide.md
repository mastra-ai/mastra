---
'@mastra/platform': patch
---

Reduced hosted Knowledge graph reads to a single request when the service supports it. Hosted graph limits are 500 pages, 5,000 notes, and 50 outside pages per request. Larger explicit limits raise a `RangeError`.
