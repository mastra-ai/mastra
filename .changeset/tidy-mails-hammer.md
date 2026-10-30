---
'@mastra/core': minor
---

Added schemas for custom dashboard definitions. These are schemas only: `@mastra/core` adds no storage methods for dashboards, and no store persists them.

**Layout**

- A definition lays out rows of widgets on a 12-column grid.
- Each widget stores its own trace aggregate, span aggregate, metrics, or scores queries. Queries have no time range; the page supplies it.
- A view can set its own `description`, `scope`, and `drilldown`, overriding the widget's. A drilldown has an `action` target and a `click` target.

**Queries**

- A query can have an optional `id`. It starts with a letter, uses only letters, digits, `_` and `-`, and is unique within its view. Column ids are also unique within a view.
- Set `compare: 'previousWindow'` on any query to compare with the previous window.
- A scores query without `scorerId` covers every scorer, with one series per scorer.

**Filters**

- `defaults.filters` and drilldown `filters` use the same filter node schema as saved views (`filterNodeSchema`).
- Filter groups can nest at most 12 levels deep (`DASHBOARD_MAX_FILTER_DEPTH`).
- The page's filters are combined with each query's own. `where` clauses are ANDed. If both set the same metrics or scores filter field, the values must agree (arrays intersect). A contradiction returns no data.

**Validation**

- `dashboardDefinitionSchema` validates a whole definition.
- `dashboardDefinitionEnvelopeSchema` checks only what a service storing dashboards needs: a known `schemaVersion`, at most 20 widgets, 1 to 8 queries per view, at most 64 KiB serialized, unique widget ids, and `kind` and `views` on every widget. New widget kinds can be stored without upgrading that service.

**New widget kinds**

- Widget `kind` accepts any non-empty string. View `options` are passed through for each kind to validate, so new widget kinds need no `@mastra/core` upgrade.
- `DASHBOARD_WIDGET_KINDS` lists the built-in kinds: `kpis`, `table`, `timeseries` and `scores`.

**Versions**

- Adding an optional field keeps `schemaVersion` the same.
- A breaking change bumps `schemaVersion` and adds an upgrade step to `migrateDashboardDefinition`. That function brings any stored version up to the current one before parsing.

**Browser apps**

- Import the dashboard schemas from `@mastra/core/storage/dashboards`. It loads no Node built-ins and uses no Node globals such as `process` or `Buffer`.
- `@mastra/core/storage` reaches agent code that reads `process` when it loads, so it fails in the browser.

```ts
import { dashboardDefinitionSchema } from '@mastra/core/storage/dashboards';

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
