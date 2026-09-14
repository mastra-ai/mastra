---
'@mastra/playground-ui': patch
---

Unified breadcrumb crumb styling. Every crumb now uses the same box as a ghost/sm button (height, radius, padding, colors), so a label sits pixel-aligned next to icon-only controls. Added `icon`, `isLoading` and `CrumbSkeleton` to `Crumb`, and `Combobox` now accepts `size="icon-sm"` with an `aria-label` to render a chevron-only switcher.
