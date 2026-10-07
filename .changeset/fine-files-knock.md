---
'@mastra/playground-ui': patch
---

Added opt-in `spacing="breathing"` to PageHeader. It reserves a 40px band above the heading and positions the eyebrow within that band, keeping the title aligned whether an eyebrow is present or not. The default, `spacing="default"`, preserves existing padding and eyebrow layout.

Before:

```tsx
<PageHeader>
  <PageHeader.Title>Organization settings</PageHeader.Title>
</PageHeader>
```

After, to reserve top space:

```tsx
<PageHeader spacing="breathing">
  <PageHeader.Title>Organization settings</PageHeader.Title>
</PageHeader>
```
