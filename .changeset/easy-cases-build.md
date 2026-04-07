---
'@mastra/memory': patch
---

Fixed observational memory formatting and repro capture for buffered runs.

Observer history now uses part timestamps when it renders dates and times. Buffering repro capture also writes `observer-exchange.json`, so buffered observer runs are easier to inspect when debugging.

After:
```ts
// .mastra-om-repro/<thread>/<run>/observer-exchange.json
```
