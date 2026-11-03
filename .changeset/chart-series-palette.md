---
'@mastra/playground-ui': minor
---

Added a series palette for charts that break down by model, provider or key: eleven `--chart-series-*` hues at one lightness and chroma per theme, plus `--chart-series-neutral`. `seriesColors(items)` colors a page's series from it: each lab reserves one hue (Anthropic orange, OpenAI green, Google indigo, Jev pink, DeepSeek blue, xAI neutral, and others), its next two models take shifted shades of that hue (a lab's other models, or every model when the page shows one lab, take hues of their own), and series with no lab take the hues left over. Call it once per page so a model keeps its color on every chart.

```ts
import { seriesColors } from '@mastra/playground-ui/domains/metrics';

// Ranked largest first.
const colors = seriesColors([
  { key: 'claude-opus-5-5', provider: 'anthropic', model: 'claude-opus-5-5' },
  { key: 'gpt-5-mini', provider: 'openai', model: 'gpt-5-mini' },
  { key: 'claude-sonnet-5-5', provider: 'anthropic', model: 'claude-sonnet-5-5' },
]);
colors.get('claude-opus-5-5'); // 'var(--chart-series-orange)'
colors.get('claude-sonnet-5-5'); // a shifted shade of orange
```
