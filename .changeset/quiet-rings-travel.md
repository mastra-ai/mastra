---
'@mastra/playground-ui': minor
---

Added two status-strip metrics so any app showing a chat runtime — Studio, Factory — reads the same way. `TokenBudget` draws a token budget as a ring, `TokenRate` draws decode throughput as a curve, and both keep their digits folded until the metric or its strip is hovered:

```tsx
import { TokenBudget } from '@mastra/playground-ui/components/TokenBudget';
import { TokenRate } from '@mastra/playground-ui/components/TokenRate';

// `metric-strip` unfolds every metric on the line at once, on hover or focus
<div className="metric-strip flex items-center gap-3">
  <TokenBudget label="Message window" tokens={14_900} threshold={30_000} working={isObserving} />
  <TokenBudget label="Observations" tokens={5_200} threshold={8_000} tone="memory" />
  <TokenRate tokensPerSec={42} history={recentRates} />
</div>;
```

`working` runs a highlight around the ring — the `shimmer-text` reading transposed to an arc — so background work is visible without a word for it. `tone` picks the budget's identity color (`messages`, `memory`, `warning`).
