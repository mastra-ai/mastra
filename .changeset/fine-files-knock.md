---
'@mastra/playground-ui': patch
---

Added opt-in `reserveTopSpace` to PageHeader. It reserves a 40px band above the heading and positions the eyebrow within that band, keeping the title aligned whether an eyebrow is present or not. The default is `false`, so existing padding and eyebrow layout are unchanged.

PageLayout is unchanged. The proposed `reserveTopBar` prop has been removed.

Before:

```tsx
<PageHeader>
  <PageHeader.Title>Organization settings</PageHeader.Title>
</PageHeader>
```

After, to reserve top space:

```tsx
<PageHeader reserveTopSpace>
  <PageHeader.Title>Organization settings</PageHeader.Title>
</PageHeader>
```
