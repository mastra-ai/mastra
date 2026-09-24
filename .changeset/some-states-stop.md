---
'@mastra/playground-ui': minor
---

Added `CompactNumber`, which shows a compact metric such as `12.3K` or `$1.2K` and reveals the full value (`12,310`) in a tooltip on hover or focus. The compact value can hide digits (`$123.45` shows as `$123`), and the full value in the tooltip keeps the currency's precision. An amount smaller than the currency's smallest unit shows as `<$0.01`, and a unit that isn't a currency, such as `credits`, shows as a plain number.

```tsx
import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';

<CompactNumber value={12310} />
<CompactNumber value={12345.67} currency="USD" />
```

The number and cost formatters now live in one place, `@mastra/playground-ui/utils/cost`. `formatCompact` is renamed to `formatCompactNumber`, and `formatCompact` and `formatCost` are no longer exported from the metrics components.

```ts
// Before
import { formatCompact, formatCost } from '@mastra/playground-ui/domains/metrics/components';

// After
import { formatCompactNumber, formatCost, formatFullNumber } from '@mastra/playground-ui/utils/cost';
```
