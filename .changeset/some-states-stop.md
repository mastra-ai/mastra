---
'@mastra/playground-ui': minor
---

Added `CompactNumber`, which shows a compact metric such as `12.3K` or `$1.2K` and reveals the full value (`12,310`) in a tooltip on hover or focus. Costs keep the precision of their currency, and an amount smaller than the currency's smallest unit shows as `<$0.01`.

```tsx
import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';

<CompactNumber value={12310} />
<CompactNumber value={12345.67} currency="USD" />
```
