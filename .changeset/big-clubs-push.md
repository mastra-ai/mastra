---
'@mastra/playground-ui': minor
---

Added a 28px display-lg text role and an over-allowance Meter variant with a label slot and a paid-from-credits caption above the bar. Fixed open dialogs crashing when resized across the mobile breakpoint.

Before, billing used the 22px display role and a plain meter:

```tsx
<Txt variant="display">$250</Txt>
<Meter value={112} max={100} aria-label="vCPU" />
```

Use the larger role and pass the amount charged in dollars:

```tsx
<Txt variant="display-lg">$250</Txt>
<Meter variant="over-allowance" value={112} max={100} paidFromCredits={4.37} label="vCPU" aria-label="vCPU" />
```
