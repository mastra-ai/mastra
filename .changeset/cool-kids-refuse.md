---
'@mastra/playground-ui': minor
---

Added weight and color props to the Txt component so text styles come from the design system instead of className overrides.

```tsx
<Txt as="h2" variant="ui-md" weight="semibold" color="neutral6">
  Settings group
</Txt>
```

Settings group titles and descriptions now use these props, which also fixes their text color outside Factory where the previous icon color utilities did not resolve.
