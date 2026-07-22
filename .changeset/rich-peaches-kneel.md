---
'@mastra/playground-ui': minor
---

Added compact sizing, custom interactive elements, and trailing actions to sidebar navigation items.

```tsx
<MainSidebar.NavLink
  // Compact density for dense lists
  size="sm"
  // Bring your own interactive element (e.g. a router Link or button)
  render={<Link to="/sessions/feature-work">Feature work</Link>}
  // Trailing control rendered beside the row, independently clickable
  action={
    <Button size="icon-sm" variant="ghost" onClick={onDelete}>
      <TrashIcon />
    </Button>
  }
/>
```
