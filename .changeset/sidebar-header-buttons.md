---
'@mastra/playground-ui': patch
---

The search and collapse buttons at the top of the sidebar now look the same: both are round, sit close together, and show their keyboard shortcut in a tooltip on hover instead of next to the icon. `Sidebar.SearchTrigger` renders a search icon by default and takes an optional `label` (defaults to `Search`), and the new `Sidebar.Badge` gives a quiet label such as `Beta` next to the brand.

```tsx
<Sidebar.Header collapsedLogo={<Logo />}>
  <Sidebar.Brand logo={<Logo />} title="Mastra" />
  <Sidebar.Badge>Beta</Sidebar.Badge>
  <Sidebar.SearchTrigger shortcut="⌘ K" onClick={openSearch} />
  <Sidebar.Trigger />
</Sidebar.Header>
```

Also fixed the sidebar lagging behind the cursor while it is resized, which let the header buttons spill past its edge, and keyboard shortcut keys now sit vertically centered in any monospace font, not only Commit Mono.
