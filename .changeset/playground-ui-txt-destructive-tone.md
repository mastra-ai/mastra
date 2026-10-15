---
'@mastra/playground-ui': minor
---

Added a `destructive` tone to `Txt` for inline error text, so red text no longer needs a color class on the component.

```tsx
<Txt variant="caption" tone="destructive" role="alert">
  Select a GitHub account.
</Txt>
```
