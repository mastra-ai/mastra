---
'@mastra/playground-ui': patch
---

Added a `useObservabilityCapabilities` hook (`@mastra/playground-ui/domains/capabilities`) that reads which observability features the server supports. Studio's traces page now uses it to list traces through the lightweight endpoint when the server doesn't support trace queries. Older servers that don't report capabilities keep the current behavior.
