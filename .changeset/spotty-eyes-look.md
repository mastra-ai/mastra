---
'@mastra/playground-ui': minor
---

Phones now get one header row instead of two. When `AppShell` has a sidebar, the page's own header row holds the navigation menu button, then the breadcrumb trail. A page with no trail shows its `PageHeader.Title`, and a page with neither shows your brand. Routed content without a `PageLayout` gets the same row from the shell.

Pass your brand and app-wide controls to `AppShell` instead of building a mobile header:

```tsx
// Before
<AppShell sidebar={<AppSidebar />} mobileHeader={<MobileTopBar />}>

// After
<AppShell
  sidebar={<AppSidebar />}
  mobileBrand={<Sidebar.Brand logo={<Logo />} title="Mastra Projects" />}
  mobileActions={<SearchButton />}
>
```

`mobileHeader` still works and keeps the old two-row layout, so nothing changes until you switch. Desktop is unchanged.

Breadcrumbs also truncate parent crumbs first when the row is tight, so the current page stays readable instead of being cut off.

`Sidebar.MobileTrigger` is now a small ghost icon button, the same size as `Sidebar.Trigger`, breadcrumbs and the other header controls, so everything in the row lines up.
