---
'@mastra/playground-ui': minor
---

Added shared building blocks so any React Router app can show the Traces, Spans and Threads pages under one header that stays mounted when switching views.

**New exports**

- `ObservabilityPageLayout` from `@mastra/playground-ui/domains/observability`: breadcrumbs plus the Traces / Spans / Threads switch. Wrap your page routes with it and pass your router's outlet as children.
- `SpansExplorerBody` and `ThreadsExplorerBody`: the full spans and threads page bodies (filters, list, panel). They take the selection and callbacks as props, so they work with any router.
- `TracesExplorer.Body`: the traces list without its own page header, for use inside `ObservabilityPageLayout`. `TracesExplorer.Layout` is unchanged.
- Helpers: `ObservabilityCapabilityGate`, `ObservabilityListBody`, `useObservabilityViews`, `useObservabilityListFilters`, `observabilityViewCrumbLabel` and URL selection helpers (`readSpanSelection`, `withSpanSelection`, `readThreadSelection`, `withThreadSelection`, `spanTraceSearch`).

```tsx
function ObservabilityRoute() {
  const navigate = useNavigate();
  return (
    <ObservabilityPageLayout
      current={viewFromPathname(useLocation().pathname)}
      features={{ spanQuery: true, threadQuery: true }}
      onViewChange={view => navigate('/' + view)}
      breadcrumbs={state => <MyBreadcrumbs label={observabilityViewCrumbLabel(state)} />}
    >
      <Outlet />
    </ObservabilityPageLayout>
  );
}
```
