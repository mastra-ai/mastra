---
'@mastra/playground-ui': major
---

Removed the separate `Chip` and `StatusBadge` exports. `Badge` is now the single compact label and status primitive, with semantic colors, muted emphasis, sizes, icons, and dot or pulse indicators.

Before:

```tsx
import { Chip } from '@mastra/playground-ui/components/Chip';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';

<Chip color="purple" intensity="muted">Baseline</Chip>
<StatusBadge variant="success" withDot>Connected</StatusBadge>
```

After:

```tsx
import { Badge } from '@mastra/playground-ui/components/Badge';

<Badge variant="accent" emphasis="muted">Baseline</Badge>
<Badge variant="success" indicator="dot">Connected</Badge>
```
