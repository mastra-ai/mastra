---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Added `align` and `stack` variants to `PageLayout.Row`. Use `stack="responsive"` for top bars that should collapse to a vertical stack on narrow viewports, and `align="center"` to vertically center children. Applied the new variants to the Prompts and Workflows top bars so the search field and primary action share a single row on desktop and stack on mobile.

```tsx
<PageLayout.Row align="center" stack="responsive">
  <ListSearch ... />
  <Button ...>Create</Button>
</PageLayout.Row>
```
