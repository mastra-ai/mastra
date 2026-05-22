---
'@mastra/playground-ui': patch
---

Added `DataList` primitives and props for building selection-aware, condensed list rows that match the Traces/Logs visual style.

**New cells** on `DataList`:

- `IdCell` — compact mono cell that truncates long IDs to 8 chars.
- `MonoCell` — compact mono + truncate text cell (for input previews, JSON summaries, etc.).
- `DateCell` — compact date cell rendering "Today" or "MMM dd".
- `TimeCell` — compact mono time cell rendering `HH:mm:ss.SSS` with the millisecond portion tinted.
- `SelectCell` — labelled checkbox cell with a shift-key range-select handler.
- `TopSelectCell` — header version with `indeterminate` support for "select all".
- `TopCells` — non-interactive header sibling of `RowButton`, for hosting top cells beside a leading select cell.

**New props** on `DataList.RowButton` and `DataList.RowLink`:

- `flushLeft` — drops the default left margin when wrapped beside a leading cell.
- `colStart` — places the row starting at a column line (e.g. `colStart={2}` to leave column 1 for a leading cell).
- `featured` — applies the highlighted background to mark the active row.

**New props** on existing wrappers:

- `as` on `DataList.Cell` and `DataList.TopCell` — render the cell as any HTML element (e.g. `<label>` so the whole cell is clickable).
- `hasLeadingCell` on `DataList.Top` — drops default gap and left padding so a leading cell sits flush, mirroring how `Row` + `RowButton` compose.

**Example** — selection row with a checkbox in column 1 and an interactive button spanning the rest:

```tsx
<DataList.Row>
  <DataList.SelectCell checked={isSelected} onToggle={shiftKey => toggle(id, shiftKey)} />
  <DataList.RowButton flushLeft colStart={2} featured={isFeatured} onClick={onRowClick}>
    <DataList.IdCell id={item.id} />
    <DataList.MonoCell>{item.input}</DataList.MonoCell>
  </DataList.RowButton>
</DataList.Row>
```

Internally the Traces and Logs list views now use the shared primitives — no behavior change for those consumers.
