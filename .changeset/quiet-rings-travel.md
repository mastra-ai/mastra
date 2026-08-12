---
'@mastra/playground-ui': minor
---

Added two status-strip metrics so any app showing a chat runtime — Studio, Factory — reads the same way. `TokenBudget` draws a token budget as a ring with its digits beside it, and `TokenRate` draws decode throughput as a waveform with the current rate:

```tsx
import { TokenBudget } from '@mastra/playground-ui/components/TokenBudget';
import { TokenRate } from '@mastra/playground-ui/components/TokenRate';

<div className="flex items-center gap-3">
  <TokenBudget
    description="When it fills, the conversation is read into memory."
    label="Message window"
    tokens={14_900}
    threshold={30_000}
    working={isObserving}
  />
  <TokenBudget label="Observations" tokens={5_200} threshold={8_000} tone="memory" />
  <TokenRate tokensPerSec={42} history={recentRates} />
</div>;
```

Clicking a budget opens a popover with a progress bar, the exact reading and `description` — what the budget is for and what happens when it fills — so the strip stays quiet without hiding what it means.

`working` runs a highlight around the ring — the `shimmer-text` reading transposed to an arc — so background work is visible without a word for it. `tone` picks the budget's identity color (`messages`, `memory`, `warning`). `TokenRate` scales its bars against a fixed ceiling rather than the run's own peak, so a steady rate reads as a steady height instead of flattening against the top of the box.
