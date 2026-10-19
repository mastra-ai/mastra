---
'@mastra/playground-ui': patch
---

Made the sidebar header buttons consistent. `Sidebar.SearchTrigger` and `Sidebar.Trigger` now share one look (the ghost icon button) and one tooltip: the label with its keyboard shortcut. `Sidebar.SearchTrigger` shows its `shortcut` in that tooltip instead of next to the icon, renders a search icon by default, and takes an optional `label` (defaults to `Search`).

```tsx
<Sidebar.Header collapsedLogo={<Logo />}>
  <Sidebar.Brand logo={<Logo />} title="Mastra" />
  <Sidebar.SearchTrigger shortcut="⌘ K" onClick={openSearch} />
  <Sidebar.Trigger />
</Sidebar.Header>
```

Also fixed the sidebar lagging behind the cursor while it is resized, which let the header buttons spill past its edge, and `Kbd` now centers its keys vertically in any monospace font, not only Commit Mono.
