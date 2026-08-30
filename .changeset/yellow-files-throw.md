---
'@mastra/playground-ui': minor
---

Removed the separate `Chip` and `StatusBadge` exports. `Badge` is now the single compact label and status primitive, with nine colors, muted emphasis, sizes, icons, and dot or pulse indicators.

`Badge` now renders an inline `<span>` instead of a `<div>`, and `BadgeProps` now extends `HTMLAttributes<HTMLSpanElement>` instead of `HTMLAttributes<HTMLDivElement>`. Update block-layout assumptions and div-specific refs or handlers when migrating.

Badges use soft corners and a subtle ring, with an inner shadow in light mode and an inner glow in dark mode.

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
