---
'@mastra/playground-ui': minor
---

Refreshed the DataList look: rows no longer draw separators, the sticky header and group subheaders share one lighter, theme-tuned band, and every corner uses the same radius.

**Every row in a list is now the same height.** Row height used to be whatever the tallest cell happened to be, so a list with an actions column or a roomier cell drifted a few pixels away from the list next to it. The row owns its height now, and skeleton rows match the real ones — no jump when data lands.

**Typography follows the content.** Headers and name cells are medium weight instead of semibold, and the letter-spacing tightening is gone. IDs and timestamps left the monospace face — IDs get wider tracking to stay scannable, timestamps get tabular figures so their columns still line up.

**Row controls only appear on hover.** Selection checkboxes on unselected rows, and the new `DataList.ActionsCell`, stay hidden until you hover the row or reach it with the keyboard, so a resting list reads as content. The column keeps its width, so nothing shifts. On a touch screen, where nothing ever hovers, they stay visible.

```tsx
// Trailing row actions — alignment, spacing and the hover reveal come with the cell
<DataList.RowWrapper>
  <DataList.RowButton colEnd={-2} onClick={open}>
    {cells}
  </DataList.RowButton>
  <DataList.ActionsCell>
    <Button variant="ghost" size="icon-xs" aria-label="Delete">
      <Trash2 />
    </Button>
  </DataList.ActionsCell>
</DataList.RowWrapper>
```

**Breaking:** a variant, three props and a component that no longer decide anything are gone.

```tsx
// Before
<DataList columns={columns} variant="lined">
  <DataList.RowButton flushLeft flushRight colEnd={-2}>
    <DataList.Cell height="compact">{status}</DataList.Cell>
    <DataList.MonoCell>{path}</DataList.MonoCell>

// After — rows are borderless, full-bleed and uniformly tall by default
<DataList columns={columns}>
  <DataList.RowButton colEnd={-2}>
    <DataList.Cell>{status}</DataList.Cell>
    <DataList.TextCell font="mono">{path}</DataList.TextCell>
```

- `variant="lined"` existed only to draw row separators. Lists that want row banding can still ask for `variant="striped"`.
- `height` on cells set row height one cell at a time, which is what let rows drift apart.
- `flushLeft` / `flushRight` dropped a row margin that no longer exists.
- `DataList.MonoCell` was a cell that only changed the typeface. `DataList.TextCell font="mono"` replaces it — same rendering, one less component.
