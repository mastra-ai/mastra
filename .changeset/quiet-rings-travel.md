---
'@mastra/playground-ui': minor
---

Added three status-strip pieces so any app showing a chat runtime — Studio, Factory — reads the same way. `TokenBudget` draws a token budget as a ring with its reading beside it, `TokenBudgetDetail` is that budget in full for a popover or panel, and `TokenRate` draws decode throughput as a waveform with the current rate:

```tsx
import { TokenBudget, TokenBudgetDetail } from '@mastra/playground-ui/components/TokenBudget';
import { TokenRate } from '@mastra/playground-ui/components/TokenRate';

<div className="flex items-center gap-1.5">
  <TokenBudget label="Message window" tokens={14_900} threshold={30_000} working={isObserving} />
  <TokenBudget label="Observations" tokens={5_200} threshold={8_000} tone="memory" />
  <TokenRate tokensPerSec={42} history={recentRates} />
</div>;

<TokenBudgetDetail
  description="Read into memory once full"
  icon={<MessageSquare />}
  label="Messages"
  projected={6_000}
  tokens={14_900}
  threshold={30_000}
/>;
```

The two are separate so the app decides how a budget opens — one trigger per budget, or one control for a whole group. `TokenBudgetDetail` hatches the slice a pending pass will free (`projected`) at the end of its bar, so the number and where it goes read together, and takes an `icon` it tints with the budget's own color so a detail row is recognizable as the ring it came from.

`working` runs a highlight around the ring — the `shimmer-text` reading transposed to an arc — so background work is visible without a word for it. `tone` picks the budget's identity color (`messages`, `memory`, `warning`). `TokenRate` scales its bars against a fixed ceiling rather than the run's own peak, so a steady rate reads as a steady height instead of flattening against the top of the box, and it draws every slot from the first render — the ones a run has not reached yet sit on the baseline, so the strip around it never changes width.
