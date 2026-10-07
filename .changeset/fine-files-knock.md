---
'@mastra/playground-ui': patch
---

Added optional `reserveTopBar` to PageLayout. It reserves the missing 40px top bar only when true; the default spacing is unchanged.

Before:

```tsx
<PageLayout variant="narrow">{content}</PageLayout>
```

After, to reserve top-bar space:

```tsx
<PageLayout variant="narrow" reserveTopBar>
  {content}
</PageLayout>
```
