---
'@mastra/playground-ui': minor
---

Added an optional `alert` prop to `DashboardRenderer` so a host can create alerts from dashboard cards. With it, each card shows a Create alert button for its open view, such as "Create alert from Agent runs". `alert.action` gets the widget, the open view, and the view's queries with the page's filter bar applied, and returns where the button links (`{ href }`), why it is disabled (`{ disabled }`), or `undefined` for no button. Links render through `alert.LinkComponent`, so your router handles them. A card the page's filters block, or that the filters exclude entirely, gets a disabled button saying why.

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  alert={{
    action: ({ view, queries }) =>
      queries.length === 1
        ? { href: `/alerts/new?query=${encodeURIComponent(JSON.stringify(queries[0]))}` }
        : { disabled: 'Only single-query views can become alerts.' },
    LinkComponent: RouterLink,
  }}
/>
```

`pageQuery(query, page)` is also exported: it applies the page's filters to a dashboard query the same way the cards' requests do, without the time window.
