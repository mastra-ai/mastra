---
'@mastra/playground-ui': patch
---

Trace filtering in the `domains/traces` module now builds on the typeahead `FilterBar` instead of `PropertyFilter`. `createTraceFilterBarFields`, `traceTokensToFilterBarItems`, `filterBarItemsToTraceTokens` and `TRACE_FILTER_BAR_OPERATORS` adapt the existing `filterX` URL tokens to FilterBar items, so existing trace filter URLs keep working. A new `TraceTimeRangeChip` renders the date range as an always-present, non-removable `Time is …` chip (default Last 7 days). `useTraceUrlState` gains `handleDateRangeChange(from, to)` to write a custom range atomically. `TracesToolbar`, `createTracePropertyFilterFields` and `neutralizeFilterTokens` are removed. `TraceColumnsMenu` now renders a ghost button. FilterBar popups size to their content and fields with a single operator skip the operator step.

New public options:

- `FilterBarField.hidden` — exclude a field from the FilterBar input's field step while chips for it still render.

  ```tsx
  const fields: FilterBarField[] = [{ id: 'entityId', label: 'Primitive ID', operators: ['is'], hidden: true }];
  ```

- `FilterBar.Chip` `removable` (default `true`) — when `false` the chip has no remove button and ignores Backspace/Delete.

  ```tsx
  <FilterBar.Chip item={item} removable={false} />
  ```

- `DateTimeRangePicker` `renderTrigger` and `onDateRangeChange` — render a custom element as the preset menu trigger (it receives the menu's props via Base UI `render`) and receive both ends of a custom range in one call.

  ```tsx
  <DateTimeRangePicker
    preset={preset}
    onPresetChange={setPreset}
    dateFrom={from}
    dateTo={to}
    onDateRangeChange={(from, to) => setRange({ from, to })}
    renderTrigger={({ label, disabled }) => (
      <button type="button" disabled={disabled}>
        {label}
      </button>
    )}
  />
  ```
