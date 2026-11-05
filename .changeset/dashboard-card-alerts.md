---
'@mastra/playground-ui': minor
---

Dashboard cards can now offer a Create alert button. Pass the new optional `alert` prop to `DashboardRenderer` to turn it on.

For each card, `alert.action` gets the widget, the open view, and that view's queries with the page's filters applied. It returns one of:

- `{ href }`: the button links there, through `alert.LinkComponent`, so your router handles it.
- `{ disabled }`: the button is disabled and shows this reason.
- `undefined`: the card shows no button.

When the page's filters block a card, or exclude everything it shows, its button is disabled and says why.

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  alert={{
    action: ({ queries }) =>
      queries.length === 1
        ? { href: `/alerts/new?query=${encodeURIComponent(JSON.stringify(queries[0]))}` }
        : { disabled: 'Only single-query views can become alerts.' },
    LinkComponent: RouterLink,
  }}
/>
```

`pageQuery(query, page)` is also exported. It applies the page's filters to a dashboard query the same way the cards' requests do, without the time window.
