---
'@mastra/playground-ui': minor
---

Simplified page frames to one component, `PageLayout`, with a required `kind` that says what the page is for. Each kind takes only the props that make sense for it, so a page can no longer pick its own width, gutter or scroll mode, and a form can no longer show breadcrumbs next to its back link.

- `kind="page"`: lists, dashboards, detail pages and explorers. The full width with the standard gutter, up to 1536px on very wide screens. Takes `breadcrumbs`, `headerActions`, `actionRow` and `header`. Add `body="workspace"` when the body is panels, an editor, a graph, a board or a chat that scroll on their own: it takes the remaining height edge to edge, as `variant="fit"` did.
- `kind="settings"`: settings pages. A centered 640px column of `SettingsGroup`s under the title. Takes `breadcrumbs`, `headerActions`, `title`, `titleAccessory`, `action` and `header`.
- `kind="form"`: create and edit forms. A centered 640px column under a back link and the title, with no breadcrumb bar. Takes `backHref`, `backLabel`, `title`, `isLoading`, `LinkComponent` and `aside`, for a live preview beside the form when the column is wide enough.

What goes inside the frame (`PageHeader`, `SettingsGroup`, `EmptyState`, `DashboardGrid`, panels) is unchanged.

**Migrating**

`PageLayout` no longer takes `variant` or `mask`, and `FormLayout` and `SettingsLayout` are no longer exported. Use the matching `kind` instead:

```tsx
// Before
<PageLayout breadcrumbs={crumbs}>{list}</PageLayout>
<PageLayout variant="fit" breadcrumbs={crumbs}>
  <AgentPanels />
</PageLayout>
<PageLayout breadcrumbs={crumbs}>
  <SettingsLayout title="Project settings">{sections}</SettingsLayout>
</PageLayout>
<FormLayout backHref="/alerts" backLabel="Alerts" title="New alert">
  {sections}
</FormLayout>

// After
<PageLayout kind="page" breadcrumbs={crumbs}>{list}</PageLayout>
<PageLayout kind="page" body="workspace" breadcrumbs={crumbs}>
  <AgentPanels />
</PageLayout>
<PageLayout kind="settings" breadcrumbs={crumbs} title="Project settings">
  {sections}
</PageLayout>
<PageLayout kind="form" backHref="/alerts" backLabel="Alerts" title="New alert">
  {sections}
</PageLayout>
```

Pages that used `variant="narrow"` move to `kind="settings"` or `kind="form"` when that is what they are, and to `kind="page"` otherwise.

**Lint**

Added the `playground-ui/no-page-width` rule and a `pageRules` preset. Turn it on for page files so a page can't center a `max-w-*` column of its own:

```ts
overrides: [{ files: ['src/pages/**/*.tsx'], rules: pageRules }]
```

Added `playground-ui/page-layout-props` to the `recommended` preset. It flags the removed `variant` and `mask` props on `PageLayout` and says which `kind` to use instead.
