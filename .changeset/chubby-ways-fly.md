---
'@mastra/editor': patch
---

Fixed Composio tool results not being validated. Resolved Composio tools now keep the output schema supplied by Composio, so tool results are checked against it: real API responses (including null or extra fields) still pass, while structurally invalid output is rejected instead of being silently returned. This also lets Composio tools be used with APIs that require an output schema, like createStep(tool).
