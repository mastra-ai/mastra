---
'@mastra/core': minor
---

Added a schema for custom dashboard definitions. A definition lays out rows of widgets on a 12-column grid; each widget stores its own trace aggregate, span aggregate, metrics, or scores queries without a time range, which the page supplies. Comparison with the previous window is set with `compare: 'previousWindow'` on any query, and a scores query without `scorerId` covers every scorer found at run time. A view can set its own `description`, `scope`, and `drilldown` (`action` and `click` targets), overriding the widget's.

`dashboardDefinitionSchema` validates a whole definition. `dashboardDefinitionEnvelopeSchema` checks only what a service storing dashboards needs (known `schemaVersion`, at most 20 widgets, 1 to 8 queries per view, 64 KiB serialized, unique widget ids, every widget has `kind` and `views`), so new widget kinds can be stored without upgrading that service.

Widget `kind` accepts any non-empty string, and view `options` are passed through for each kind to validate, so new widget kinds need no `@mastra/core` upgrade. `DASHBOARD_WIDGET_KINDS` lists the built-in kinds. Adding an optional field keeps `schemaVersion` the same; a breaking change bumps it and comes with an upgrade step in `migrateDashboardDefinition`, which brings any stored version up to the current one before parsing.

```ts
import { dashboardDefinitionSchema } from '@mastra/core/storage';

const result = dashboardDefinitionSchema.safeParse({
  schemaVersion: 1,
  rows: [
    {
      widgets: [
        {
          id: 'agents',
          span: 6,
          kind: 'table',
          views: [
            {
              queries: [
                {
                  source: 'traceAggregate',
                  measures: ['count', 'errorRate'],
                  groupBy: ['rootEntityName'],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
```
