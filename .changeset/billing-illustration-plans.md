---
'@mastra/playground-ui': minor
---

Added plan drawings to `BillingIllustration`: `free`, `starter`, `teams` and `enterprise`, for plan cards and the current plan card on Billing. Put `billingIllustrationHoverGroup` on the card so its screens and windows light up when the card is hovered or focused.

```tsx
import {
  BillingIllustration,
  billingIllustrationHoverGroup,
} from '@mastra/playground-ui/components/BillingIllustration';

<div className={`${billingIllustrationHoverGroup} relative overflow-clip`}>
  <BillingIllustration
    name="teams"
    tone="faded"
    className="absolute -top-1.5 -right-1.5 size-28 mask-b-from-50% mask-l-from-50%"
  />
</div>;
```
