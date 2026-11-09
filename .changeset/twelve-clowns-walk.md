---
'@mastra/mcp-apps-components': minor
---

Added `@mastra/mcp-apps-components/dashboards`, a strict schema for storing dashboard definitions. Unlike core's `dashboardDefinitionSchema`, it only accepts definitions the dashboard renderer can draw: built-in widget kinds only, each view's options checked against its kind, and each kind's own checks run at both org and project scope. Every problem is reported as a zod issue with its path, such as `rows.0.widgets.1.views.0.options.series.0.value`.

**Before**

```ts
import { dashboardDefinitionEnvelopeSchema } from '@mastra/core/storage/dashboards';

dashboardDefinitionEnvelopeSchema.parse(body.definition);
const definition = body.definition as Record<string, unknown>;
```

**After**

```ts
import { strictDashboardDefinitionSchema } from '@mastra/mcp-apps-components/dashboards';
import type { StrictDashboardDefinition } from '@mastra/mcp-apps-components/dashboards';

const definition: StrictDashboardDefinition = strictDashboardDefinitionSchema.parse(body.definition);
```

Use `strictDashboardWidgetSchema` to check a single widget. The subpath doesn't load the package's bundled apps.
