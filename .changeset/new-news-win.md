---
'@mastra/playground-ui': minor
---

Toolbar and filter bar controls now share one look: the same paddings, icon gaps, chevron and spacing between controls.

**Time range.** A filter bar's time range is now the `DateTimeRangePicker` itself, so it looks and behaves the same on every page: a calendar icon, the range and a chevron, with no separate "Time" label. Pass `defaultPreset` to show a × that resets a custom range; it replaces the chevron while a custom range is applied.

Added `FilterBar.TimeRange` with `FILTER_BAR_TIME_RANGE_FIELD`, `FILTER_BAR_TIME_RANGE_ITEM` and `FILTER_BAR_TIME_RANGE_FIELD_ID`. The `TRACE_TIME_RANGE_*` names and `TraceTimeRangeChip` are deprecated aliases and keep working.

```tsx
import {
  FilterBar,
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/components/FilterBar';

<FilterBar
  fields={[FILTER_BAR_TIME_RANGE_FIELD, ...fields]}
  operators={operators}
  value={[FILTER_BAR_TIME_RANGE_ITEM, ...items]}
  onValueChange={setItems}
>
  <FilterBar.Chips
    renderChip={item =>
      item.fieldId === FILTER_BAR_TIME_RANGE_FIELD_ID ? (
        <FilterBar.TimeRange preset={preset} onPresetChange={setPreset} defaultPreset="last-7d" />
      ) : (
        <FilterBar.Chip item={item} />
      )
    }
  />
  <FilterBar.Input />
</FilterBar>;
```

`DateTimeRangePicker` gains `size`, `defaultPreset` and `ref` (the trigger button). Its `renderTrigger` prop is removed: the trigger is always the shared calendar button.

**Other controls.**

- Added `ClearFiltersButton`, a round reset icon button with a tooltip, used for every toolbar's "clear filters".
- Added `TriggerChevron` and `ButtonChevron`, the one chevron every dropdown trigger (`Select`, `Combobox`, the date picker) shows.
- `ComboboxTrigger` uses that chevron instead of the up-down one.
- Icons in every interactive control (buttons, fields, search inputs, filter chips, menu and command rows) follow one rule: muted at rest, brighter on hover. Two new theme tokens, `--control-icon-rest` and `--control-icon-hover`, set those colours; menus retune them, and icon-only controls always brighten. Search fields and combobox fields now brighten their icons on hover like buttons do.
- Icons take their size from the control they sit in, as in a Button: filter chips and search inputs no longer size their own icons.
- `ListSearch` defaults to the `sm` toolbar size, and `SearchInput`'s icon sits at the same inset as a button's.
- `ActionRow` and `FilterBar` space their controls 6px apart.
