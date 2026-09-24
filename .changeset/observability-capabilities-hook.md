---
'@mastra/playground-ui': patch
---

Added a `useObservabilityCapabilities` hook (`@mastra/playground-ui/domains/capabilities`) that reads which observability features the server supports. Studio's traces page now uses it to list traces through the lightweight endpoint when the server doesn't support trace queries. Older servers that don't report capabilities keep the current behavior.

Also added `useTraceQueryAvailable`, which returns `{ isLoading, enabled }`. `enabled` is false while capabilities load and when the server doesn't support trace queries. Studio uses it to pick the traces list endpoint and to hide feedback on servers without trace query support.

Also exported `useTracesListSource` from `@mastra/playground-ui/domains/traces`, so other apps can rebuild the traces list (auto-refresh, rolling time window, list rows). It takes `withQueryTrace` and `enabled` as inputs and does not read capabilities itself; callers decide which endpoint to use.
