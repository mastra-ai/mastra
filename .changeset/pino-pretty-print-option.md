---
"@mastra/loggers": patch
---

Add `prettyPrint` option to PinoLogger for clean JSON output compatible with Datadog, Loki, and CloudWatch.
```ts
// Single-line JSON output for log aggregators
new PinoLogger({ prettyPrint: false })

// Default pretty output (unchanged behavior)
new PinoLogger({ prettyPrint: true })
```
