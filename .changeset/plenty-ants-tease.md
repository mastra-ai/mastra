---
'@mastra/observability': patch
---

Fixed spans staying open forever when their parent span ended first. A span that ends now hands its still-open children to the nearest live ancestor, so ending the trace root closes them too.
