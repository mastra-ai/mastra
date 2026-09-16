---
'@mastra/playground-ui': minor
---

Added shared composer mode colors, pointer spotlight, and input sizing. Factory and Studio now use the same composer surface and spacing, with Build as the default appearance.

Set mode and activity independently, and reuse the mode color for application controls:

```tsx
<ComposerRing mode="plan" busy={isRunning}>
  <ComposerBox>
    <ComposerInput variant="textarea" />
    <ComposerActions>
      <ComposerModeLabel mode="plan">Plan</ComposerModeLabel>
    </ComposerActions>
  </ComposerBox>
</ComposerRing>
```
