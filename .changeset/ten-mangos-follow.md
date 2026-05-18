---
'@mastra/playground-ui': patch
---

Migrated the Tooltip primitive to Base UI while preserving the existing API. Existing `<TooltipTrigger asChild>` usage continues to work unchanged, and Base UI's native `render` prop is now also supported on `TooltipTrigger` so consumers wrapping anchors, custom router links, or icons can pass the element directly without an `asChild` adapter:

```tsx
// Still supported
<TooltipTrigger asChild>
  <Button>Save</Button>
</TooltipTrigger>

// New: pass the element via Base UI's native API
<TooltipTrigger render={<Button>Save</Button>} />
```

Also fixed the arrow rendering so the diagonal stroke meets the popup outline at the exact same pixel center on every side, removing the ~1px seam previously visible where the arrow joined the popup edge.
