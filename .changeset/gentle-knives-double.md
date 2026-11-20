---
'@mastra/playground-ui': major
---

Simplified page frames to three choices, one per kind of page: `PageLayout` for lists, dashboards, detail pages and explorers, `FormLayout` for create and edit forms, and `SettingsLayout` for settings pages. A page no longer picks a width, gutter or scroll mode.

**PageLayout**

Removed the `variant` and `mask` props. Every page uses the full width with the standard gutter, up to 1536px on very wide screens. A body that is one entity's workspace (panels, editor, graph, board or chat that scroll on their own) goes in `PageLayout.Workspace`, which takes the remaining height edge to edge, as `variant="fit"` did.

```tsx
// Before
<PageLayout variant="fit" breadcrumbs={crumbs}>
  <AgentPanels />
</PageLayout>

// After
<PageLayout breadcrumbs={crumbs}>
  <PageLayout.Workspace>
    <AgentPanels />
  </PageLayout.Workspace>
</PageLayout>
```

Pages that used `variant="narrow"` drop the prop, or move to `FormLayout` or `SettingsLayout` when that is what they are.

Added `PageLayout.Grid`, a 12-column grid for laying out cards and panels, with the same gap and breakpoint as dashboard widgets. Children span the full width until they set a `col-span-*`, and every child stacks at full width on narrow pages:

```tsx
<PageLayout.Grid>
  <section className="col-span-8">{details}</section>
  <aside className="col-span-4">{properties}</aside>
</PageLayout.Grid>
```

**SettingsLayout**

`SettingsLayout` now renders the whole page frame and takes `breadcrumbs` and `headerActions`, so it no longer goes inside a `PageLayout`.

```tsx
// Before
<PageLayout breadcrumbs={crumbs}>
  <SettingsLayout title="Project settings">{sections}</SettingsLayout>
</PageLayout>

// After
<SettingsLayout breadcrumbs={crumbs} title="Project settings">
  {sections}
</SettingsLayout>
```

**FormLayout**

Added `aside`, for a live preview beside the form when the column is wide enough (above the fields otherwise). A form page has a back link and a title, and no breadcrumbs.

**Lint**

Added the `playground-ui/no-page-width` rule and a `pageRules` preset. Turn it on for page files so a page can't center a `max-w-*` column of its own:

```ts
overrides: [{ files: ['src/pages/**/*.tsx'], rules: pageRules }]
```
