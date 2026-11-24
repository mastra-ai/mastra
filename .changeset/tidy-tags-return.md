---
'@mastra/observability': patch
---

Fixed durable agents losing trace tags and request context when a span ends. On Inngest, the ClickHouse store saved these runs with no tags, so a tag filter did not find them, and token and cost metrics had no tags.
