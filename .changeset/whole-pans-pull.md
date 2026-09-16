---
'@mastra/playground-ui': minor
---

Added shared composer color tones, pointer spotlight, and input sizing. The composer surface and spacing are shared across consumers, with green as the default appearance.

Set tone and activity independently, and reuse the tone for application controls. Supported tones are `green`, `purple`, `orange`, and `default`; applications map their own mode IDs to these tones:

```tsx
<ComposerRing tone="purple" busy={isRunning}>
  <ComposerBox>
    <ComposerInput variant="textarea" />
    <ComposerActions>
      <ComposerToneLabel tone="purple">Plan</ComposerToneLabel>
    </ComposerActions>
  </ComposerBox>
</ComposerRing>
```
