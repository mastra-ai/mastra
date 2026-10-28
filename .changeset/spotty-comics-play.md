---
'@mastra/playground-ui': patch
---

Added `METRICS_DASHBOARD`, the built-in Metrics dashboard as a dashboard definition. Pass it to `DashboardRenderer` to render the Metrics page: KPIs, breakdown, token usage, agent runs, failure rate, latency and distinct IDs on every page, and scores on project pages only.

```tsx
import { DashboardRenderer, METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards';

<DashboardRenderer definition={METRICS_DASHBOARD} onDrilldown={openDrilldown} />;
```
