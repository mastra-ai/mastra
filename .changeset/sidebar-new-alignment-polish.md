---
'@mastra/playground-ui': minor
---

Fixed sidebar alignment and collapse behavior:

- The header logo now lines up with the nav icons.
- Collapsed section dividers sit centered between icons, and rows no longer shift when the sidebar collapses.
- The sidebar toggle shows the same panel icon in both states.
- The main content card now sits flush against the sidebar edge in every app.

Added a `collapsedLogo` prop to `SidebarNew.Header`. When the sidebar is collapsed, the header shows this logo and swaps it for a centered toggle on hover or keyboard focus, without jumping or flashing while the sidebar collapses.

```tsx
<SidebarNew.Header collapsedLogo={<LogoWithoutText className="size-6" />}>
  <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra" />
  <SidebarNew.Trigger />
</SidebarNew.Header>
```
