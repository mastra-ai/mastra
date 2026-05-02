---
'@mastra/playground-ui': minor
---

Removed the `CombinedButtons` component. Use `ButtonsGroup` with `spacing="close"` for the same segmented-style cluster of toggle buttons.

```tsx
// Before
<CombinedButtons>
  <Button>Agent</Button>
  <Button>Model</Button>
</CombinedButtons>

// After
<ButtonsGroup spacing="close">
  <Button>Agent</Button>
  <Button>Model</Button>
</ButtonsGroup>
```
