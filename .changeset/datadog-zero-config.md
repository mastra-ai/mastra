---
'@mastra/datadog': patch
---

Make Datadog exporter zero-config compatible

The Datadog exporter can now be instantiated without any configuration by reading credentials from environment variables:

- `DD_LLMOBS_ML_APP` - ML application name
- `DD_API_KEY` - Datadog API key
- `DD_SITE` - Datadog site (defaults to `datadoghq.com`)
- `DD_ENV` - Environment name

```typescript
// Zero-config usage - reads from environment variables
const exporter = new DatadogExporter();
```
