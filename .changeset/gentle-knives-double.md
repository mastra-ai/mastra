---
'@mastra/playground-ui': major
---

Simplified page frames to three choices, one per kind of page: `PageLayout` for lists, dashboards, detail pages and explorers, `FormLayout` for create and edit forms, and `SettingsLayout` for settings pages. A page no longer picks a width, gutter or scroll mode.

**PageLayout**

Removed the `variant` and `mask` props. Every page uses the full width with the standard gutter. A body that is one entity's workspace (panels, editor, graph, board or chat that scroll on their own) goes in `PageLayout.Workspace`, which takes the remaining height edge to edge, as `variant="fit"` did.

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

Added `aside`, for a live preview beside the form when the column is wide enough (above the fields otherwise), and `breadcrumbs`, for apps whose only way to reopen a hidden sidebar lives in the page's bar.
