---
'@mastra/playground-ui': minor
---

Phones now get one header row instead of two. When `AppShell` has a sidebar, each page's header row holds the navigation menu button, then the breadcrumb trail, then your app-wide controls. A page with no trail shows your brand. Long trails show the parent and the current page on that row, with a … button in front that lists the levels it hides, each one still a link.

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

Every routed screen should render a `PageLayout` so it gets the row, including error screens. `ErrorBoundaryFallback` is now exported so a custom fallback can wrap the default error screen:

```tsx
<ErrorBoundary
  fallback={props => (
    <PageLayout variant="fit">
      <ErrorBoundaryFallback {...props} variant="section" />
    </PageLayout>
  )}
>
```

`mobileHeader` still works and keeps the old two-row layout, so nothing changes until you switch. Desktop is unchanged.

`Sidebar.MobileTrigger` is now a small ghost icon button, the same size as the other header controls, with a larger tap area. Parent breadcrumbs truncate before the current page, so the page name stays readable.
