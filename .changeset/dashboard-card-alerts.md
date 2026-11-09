---
'@mastra/playground-ui': minor
---

Dashboard cards can now offer a Create alert button. Pass the new optional `alert` prop to `DashboardRenderer` to turn it on.

For each card, `alert.action` gets the widget, the open view, that view's queries with the page's filters applied, and its `sources`: each distinct number the view shows, read from one query. A source has a `label` (the series, column or KPI), its `query` and a `ref` (`measure`, `field`, `percentile`, `groups` or `notGroups`). A value that combines several queries, such as a ratio or a sum, is listed as one source per part.

`alert.action` returns one of:

- `{ href }`: the button links there, through `alert.LinkComponent`, so your router handles it.
- `{ disabled }`: the button is disabled and shows this reason.
- An array aligned with `sources`, one `{ href }`, `{ disabled }` or `undefined` (left out) per source. A card with several sources you can link opens a menu of them, each disabled one showing its reason. With one to link, the button links straight to it. With none, the button is disabled with their reasons.
- `undefined`: the card shows no button.

When the page's filters block a card, or exclude everything it shows, its button is disabled and says why. A source whose own query the page's filters exclude is disabled in the menu, and isn't passed to `alert.action`.

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  alert={{
    action: ({ sources }) =>
      sources.map(source =>
        source.ref.percentile === undefined
          ? { href: `/alerts/new?query=${encodeURIComponent(JSON.stringify(source.query))}` }
          : { disabled: 'Percentile alerts are not supported yet.' },
      ),
    LinkComponent: RouterLink,
  }}
/>
```

`pageQuery(query, page)` is also exported. It applies the page's filters to a dashboard query the same way the cards' requests do, without the time window.

`DropdownMenu.LinkItem` is a new menu row that navigates; pass `render` to route it through your framework's link.
