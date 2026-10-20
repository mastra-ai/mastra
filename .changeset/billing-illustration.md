---
'@mastra/playground-ui': minor
---

Added `BillingIllustration`, a family of line drawings for billing screens. It starts with the four project sizes (Serverless, Small, Medium, Large), for example as a thumbnail beside each project in a Billing projects table. It is decorative, hidden from screen readers, and works in light and dark themes. Size it with `className`, and use `tone="muted"` or `tone="faded"` for a quieter drawing.

```tsx
import { BillingIllustration } from '@mastra/playground-ui/components/BillingIllustration';

<BillingIllustration name="medium" className="size-9" />;
```
