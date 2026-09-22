---
'@mastra/playground-ui': patch
---

`PageLayout` is now a minimal shell: `breadcrumbs`, `headerActions` (renamed from `actions`), a new `actionRow` slot pinned above the scrolling body, and `children`. The `<main>` body carries `p-4` by default and no longer accepts `className`. The `PageLayout.TopArea` / `MainArea` / `Row` / `Column` slots, `NoDataPageLayout`, and `PageShell` are removed — pass toolbars via `actionRow` and compose the body with plain elements.
