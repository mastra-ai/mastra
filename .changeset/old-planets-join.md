---
'@mastra/playground-ui': minor
---

Changed the sidebar More row to work like Linear's.

**More menu.** More opens a floating menu sized to its content, listing the optional links you moved out of the sidebar, then "Customize sidebar". Opening it no longer pushes the rest of the sidebar down. A link from the More menu appears in place while you are on its page and leaves when you navigate away.

**Customize sidebar.** "Customize sidebar" opens a dialog listing every optional link per section. Each link has one of three placements:

- **Always show**: stays in the sidebar.
- **Hide in More menu**: reachable from More.
- **Never show**: hidden from both the sidebar and More.

Right-click an optional link in the sidebar to change its placement without opening the dialog. Choices save in local storage and survive reloads.

Pass `visibilityStorageKey` to `Sidebar.Sections` to scope saved choices per product, and `defaultVisible` on an optional link to show it by default. A section with a single optional link keeps showing it without a More row. `recentItemsStorageKey` is replaced by `visibilityStorageKey`, and links are no longer promoted automatically after a visit.

```tsx
// Before
<SidebarNew.Sections sections={sections} recentItemsStorageKey="my-app:sidebar" />

// After
<Sidebar.Sections
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

Saved visit history is not migrated. Users can pick placements again through More → Customize sidebar.
