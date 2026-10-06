---
'@mastra/playground-ui': minor
---

Changed the sidebar More row to work like Linear's. More opens a floating menu with the hidden links and a "Customize sidebar" submenu where each optional link can be shown or hidden. Choices are saved in local storage and survive reloads. Opening More no longer pushes the rest of the sidebar down. A hidden link still appears in place while you are on its page, and disappears again when you leave.

Pass `visibilityStorageKey` to `SidebarNew.Sections` to scope saved choices per product, and `defaultVisible` on an optional link to show it by default. A section with a single optional link keeps showing it without a More row. `recentItemsStorageKey` is replaced by `visibilityStorageKey`, and links are no longer promoted automatically after a visit.

Replace the removed storage-key prop when upgrading:

```tsx
// Before
<SidebarNew.Sections sections={sections} recentItemsStorageKey="my-app:sidebar" />

// After
<SidebarNew.Sections sections={sections} visibilityStorageKey="my-app:sidebar-visibility" />
```

Saved visit history is not migrated. Users can show optional links again through More → Customize sidebar. Changing `visibilityStorageKey` loads the saved choices for the new scope.

`MainSidebar.NavHeader` and `MainSidebar.Sections` now render the `SidebarNew` versions, so their section headers use `SidebarNew` spacing and text colour.

```tsx
<SidebarNew.Sections
  visibilityStorageKey="my-app:sidebar"
  sections={[
    {
      key: 'primitives',
      links: [{ name: 'Agents', url: '/agents' }],
      moreLinks: [
        { name: 'Tools', url: '/tools' },
        { name: 'Workspaces', url: '/workspaces', defaultVisible: true },
      ],
    },
  ]}
/>
```
