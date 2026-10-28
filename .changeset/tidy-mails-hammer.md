---
'@mastra/core': minor
'@mastra/client-js': patch
---

Added a schema for custom dashboard definitions. A definition lays out rows of widgets on a 12-column grid; each widget stores its own trace aggregate, span aggregate, metrics, or scores queries without a time range, which the page supplies.

`dashboardDefinitionSchema` validates a whole definition. `dashboardDefinitionEnvelopeSchema` checks only what a service storing dashboards needs (known `schemaVersion`, at most 20 widgets, 1 to 8 queries per view, 64 KiB serialized, unique widget ids, every widget has `kind` and `views`), so new widget kinds can be stored without upgrading that service.

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
