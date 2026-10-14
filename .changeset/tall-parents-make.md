---
'@mastra/playground-ui': patch
---

Added a `flush` variant to `InputGroupAddon`. Use it to place adjacent number steppers at the field edge without a gap or edge inset.

```tsx
<InputGroupAddon align="inline-end" variant="flush">
  <InputNumberDecrement />
  <InputNumberIncrement />
</InputGroupAddon>
```
