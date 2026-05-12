---
'@mastra/observability': minor
---

Apply `SensitiveDataFilter` by default

The `Observability` registry now auto-applies a `SensitiveDataFilter` span output processor to every configured instance, so secrets (API keys, tokens, passwords, etc.) are redacted before they reach exporters such as the Mastra cloud exporter. This protects against accidentally exporting sensitive data when the filter was not added manually.

A new top-level `sensitiveDataFilter` option on the `Observability` registry config controls this behavior:

- `true` (default): apply `SensitiveDataFilter` with default options.
- `false`: opt out of auto-applied filtering.
- a `SensitiveDataFilterOptions` object: customize the filter (sensitive fields, redaction token, redaction style).

If a config already includes a `SensitiveDataFilter` in `spanOutputProcessors`, the auto-applied filter is skipped to avoid double redaction. Pre-instantiated `ObservabilityInstance` values are not modified.

**Before:**

```typescript
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

new Observability({
  configs: {
    default: {
      serviceName: 'mastra',
      exporters: [new DefaultExporter(), new CloudExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    },
  },
});
```

**After:**

```typescript
import { Observability, DefaultExporter, CloudExporter } from '@mastra/observability';

new Observability({
  configs: {
    default: {
      serviceName: 'mastra',
      exporters: [new DefaultExporter(), new CloudExporter()],
    },
  },
  // Optional: customize or disable the auto-applied filter.
  // sensitiveDataFilter: false,
  // sensitiveDataFilter: { sensitiveFields: ['myCustomSecret'] },
});
```
