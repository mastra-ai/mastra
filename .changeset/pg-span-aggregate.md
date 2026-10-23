---
'@mastra/pg': minor
---

Added `aggregateSpans()` to the PostgreSQL observability store, so `POST /observability/spans/aggregate` works with PostgreSQL. It groups the same spans `querySpans()` returns and attributes token and cost usage to the span that recorded it. The store now reports the `span-aggregate` feature.
