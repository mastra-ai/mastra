---
'@mastra/observability': patch
---

Fixed requestContext filtering in span creation to prevent large objects from being serialized into trace data.
