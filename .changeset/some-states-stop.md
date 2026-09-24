---
'@mastra/playground-ui': minor
---

Added `CompactNumber`, which shows a compact metric such as `12.3K` or `$1.2K` and reveals the full value (`12,310`) in a tooltip on hover or focus. Studio's metrics KPI cards now use it, and metrics values use an uppercase `K` suffix to match. Costs are rounded to the cent everywhere, and amounts under a cent show as `<$0.01`.

```tsx
import { CompactNumber } from '@mastra/playground-ui/components/CompactNumber';

<CompactNumber value={12310} />
<CompactNumber value={12345.67} currency="USD" />
```
