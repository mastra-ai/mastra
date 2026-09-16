---
'@mastra/playground-ui': patch
---

Scoped SidebarNew semantic token defaults to opt-in components and removed duplicate utility generation. Standard classes such as `bg-card` remain available through the shared stylesheet.

Migrated the shared `MainSidebar` navigation to semantic colors, so both `MainSidebar` and `SidebarNew` use the `new-theme` scope directly without sidebar-specific token aliases. This updates the built-in sidebar colors in existing consumers, including light and dark mode, mobile drawers, and tooltips.
