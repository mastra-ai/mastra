---
'@mastra/playground-ui': minor
---

Added `PlanIllustration`, a line drawing for each plan (Free, Starter, Teams, Enterprise) to show behind plan cards. It is decorative, hidden from screen readers, and works in light and dark themes. Use `tone="muted"` for a stronger drawing, such as on a current plan card. Add `group/plan-card` to the card, and the drawing's screens and windows light up when the card is hovered or focused.

```tsx
import { PlanIllustration } from '@mastra/playground-ui/components/PlanIllustration';

<div className="group/plan-card relative overflow-clip">
  <PlanIllustration plan="starter" className="absolute -top-1.5 -right-1.5" />
</div>;
```
