---
'@mastra/playground-ui': minor
---

Removed the separate `Chip`, `ChipsGroup`, and `StatusBadge` exports. `Badge` is now the single compact label and status primitive, with nine color-based variants, muted emphasis, sizes, icons, and dot or pulse indicators. Its variants are `neutral`, `green`, `red`, `blue`, `yellow`, `purple`, `orange`, `cyan`, and `pink`; omitting `variant` uses `neutral`.

`ChipsGroup` has no direct replacement. Use a layout element appropriate to the surrounding UI around `Badge` instances.

`Badge` now renders an inline `<span>` instead of a `<div>`, and `BadgeProps` now extends `HTMLAttributes<HTMLSpanElement>` instead of `HTMLAttributes<HTMLDivElement>`. Update block-layout assumptions and div-specific refs or handlers when migrating.

Badges use soft corners and a subtle ring, with an inner shadow in light mode and an inner glow in dark mode.

Before:

```tsx
import { Chip, ChipsGroup } from '@mastra/playground-ui/components/Chip';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';

<ChipsGroup>
  <Chip color="purple" intensity="muted">Baseline</Chip>
  <Chip color="blue" intensity="muted">Candidate</Chip>
</ChipsGroup>
<StatusBadge variant="success" withDot>Connected</StatusBadge>
```

After:

```tsx
import { Badge } from '@mastra/playground-ui/components/Badge';

<div className="flex items-center gap-1">
  <Badge variant="purple" emphasis="muted">Baseline</Badge>
  <Badge variant="blue" emphasis="muted">Candidate</Badge>
</div>
<Badge variant="green" indicator="dot">Connected</Badge>
```
