---
'@mastra/playground-ui': minor
---

Added a shared `PageBreadcrumbs` component (`@mastra/playground-ui/components/PageBreadcrumbs`) that renders a `CrumbDef[]` list inside `PageLayout`, linking every crumb except the current page through the `LinkComponent` you pass in. `Crumb` now also accepts `href`.
