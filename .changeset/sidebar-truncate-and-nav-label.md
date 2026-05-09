---
'@mastra/playground-ui': minor
---

**Added** `MainSidebar.NavLabel` — collapse-aware label slot for `asChild` nav items. When the sidebar collapses to icon-only mode, the label hides via `VisuallyHidden` (still announced by screen readers) instead of leaking outside the 36px icon rail. The default `link={...}` path was already collapse-aware; `asChild` consumers now have a matching primitive.

```tsx
// Before: text leaked visually when the sidebar collapsed
<MainSidebar.NavLink asChild>
  <button>
    <Bot />
    Agents
  </button>
</MainSidebar.NavLink>

// After: wrap labels in MainSidebar.NavLabel
<MainSidebar.NavLink asChild>
  <button>
    <Bot />
    <MainSidebar.NavLabel>Agents</MainSidebar.NavLabel>
  </button>
</MainSidebar.NavLink>
```

**Improved** truncation handling for nav items and section headers. Long labels now clip with a single-line ellipsis instead of wrapping to a second line during the collapse/expand transition, eliminating layout jumps at narrow widths.
