---
'@mastra/playground-ui': minor
---

Removed the unused outlined tab frame. Contained tabs now use the inset frame by default; explicit frame="inset" remains supported.

Before:

```tsx
<Tabs defaultTab="overview" appearance="contained" frame="stroke">
  {children}
</Tabs>
```

After:

```tsx
<Tabs defaultTab="overview" appearance="contained" frame="inset">
  {children}
</Tabs>
```

The same frame change applies to TabbedContainer.
