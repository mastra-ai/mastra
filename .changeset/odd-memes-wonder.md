---
'@mastra/playground-ui': minor
---

Added `DashboardRenderer` (`@mastra/playground-ui/domains/dashboards`), which renders a stored dashboard definition on a 12-column grid. It ships four widget kinds that rebuild today's Metrics cards from JSON: `kpis`, `timeseries`, `table` and `scores`. Each widget runs its own queries with the page's time range and filters, and a widget that fails to parse, query or render shows its own error while the rest of the dashboard still renders.

When the time range, a filter or a tab changes, a widget shows a skeleton until its own answer arrives instead of the previous figures, so a slow request never shows one range's numbers under another. A widget re-reading an answer it already has keeps it on screen, dimmed. KPI cards now set `aria-busy` while their reading loads or updates.

The renderer reads the page's time range and filters from `MetricsProvider`, so render it inside one. Hosts can add their own widget kinds without changing the renderer:

```tsx
import { z } from 'zod/v4';
import { DashboardRenderer, defineWidgetKind } from '@mastra/playground-ui/domains/dashboards';
import { MetricsProvider } from '@mastra/playground-ui/domains/metrics';

const noteKind = defineWidgetKind({
  kind: 'note',
  optionsSchema: z.object({ text: z.string() }),
  component: ({ views }) => <p>{views[0].options.text}</p>,
});

<MetricsProvider preset={preset} filterTokens={tokens} onPresetChange={setPreset} onFilterTokensChange={setTokens}>
  <DashboardRenderer
    definition={definition}
    scope="project"
    kinds={[noteKind]}
    onDrilldown={(page, scope) => open(page, scope)}
  />
</MetricsProvider>;
```

The `@mastra/core` peer range is now `>=1.81.0-0 <2.0.0-0`: the renderer imports `@mastra/core/storage/dashboards`, which earlier core releases don't ship.
