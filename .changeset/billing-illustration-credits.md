---
'@mastra/playground-ui': minor
---

Added `credits` to `BillingIllustration`: two coin stacks for the top right of a credits card. Put `billingIllustrationHoverGroup` on the card, and a coin drops onto the short stack when the card is hovered or focused.

```tsx
import {
  BillingIllustration,
  billingIllustrationHoverGroup,
} from '@mastra/playground-ui/components/BillingIllustration';

<div className={`${billingIllustrationHoverGroup} relative overflow-clip`}>
  <BillingIllustration
    name="credits"
    tone="muted"
    className="absolute top-1 right-1 h-21.5 w-auto mask-b-from-50% mask-l-from-50%"
  />
</div>;
```
