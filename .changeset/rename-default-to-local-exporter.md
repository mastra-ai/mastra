---
'@mastra/observability': minor
---

Rename `DefaultExporter` to `LocalExporter`

The `DefaultExporter` class has been renamed to `LocalExporter` to better reflect its purpose of persisting traces to local storage for viewing in Mastra Studio.

**Migration:**

```typescript
// Before
import { DefaultExporter } from '@mastra/observability';
new DefaultExporter();

// After
import { LocalExporter } from '@mastra/observability';
new LocalExporter();
```

**Backward Compatibility:**

`DefaultExporter` is still available as a deprecated alias for backward compatibility and will continue to work. However, we recommend updating to `LocalExporter` as the old name will be removed in a future major version.

```typescript
// This still works but shows a deprecation warning in TypeScript
import { DefaultExporter } from '@mastra/observability';
```

**Related Changes:**
- `DefaultExporterConfig` type renamed to `LocalExporterConfig` (with deprecated alias)
- Internal exporter name changed from `mastra-default-observability-exporter` to `mastra-local-observability-exporter`
