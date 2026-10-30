---
'@mastra/playground-ui': minor
---

Added `METRICS_DASHBOARD`, the built-in Metrics dashboard as a dashboard definition. Pass it to `DashboardRenderer` to render the Metrics page: token usage and agent runs (with its failure rate view), latency and distinct IDs, then the breakdown, on org and project pages alike. The definition is frozen; copy it with `structuredClone` before customising.

```tsx
import { DashboardRenderer, METRICS_DASHBOARD } from '@mastra/playground-ui/domains/dashboards';

<DashboardRenderer definition={METRICS_DASHBOARD} scope={scope} onDrilldown={openDrilldown} />;
```
