---
'@mastra/playground-ui': minor
---

Added `DashboardRenderer` (`@mastra/playground-ui/domains/dashboards`), which renders a stored dashboard definition on a 12-column grid. It ships four widget kinds that rebuild today's Metrics cards from JSON: `kpis`, `timeseries`, `table` and `scores`. Each widget runs its own queries with the page's time range and filters, and a widget that fails to parse, query or render shows its own error while the rest of the dashboard still renders.

When the time range, a filter or a tab changes, a widget shows a skeleton until its own answer arrives instead of the previous figures, so a slow request never shows one range's numbers under another. A widget re-reading an answer it already has keeps it on screen, dimmed. KPI cards now set `aria-busy` while their reading loads or updates.

Hosts can add their own widget kinds without changing the renderer:

```tsx
import { DashboardRenderer, defineWidgetKind } from '@mastra/playground-ui/domains/dashboards';

const noteKind = defineWidgetKind({
  kind: 'note',
  optionsSchema: z.object({ text: z.string() }),
  component: ({ views }) => <p>{views[0].options.text}</p>,
});

<DashboardRenderer definition={definition} kinds={[noteKind]} onDrilldown={(page, scope) => open(page, scope)} />;
```
