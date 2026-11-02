---
'@mastra/observability': patch
---

Stored spans now carry the service name from the Observability config when the span metadata does not set one, so span and trace filters on that service name find them.
