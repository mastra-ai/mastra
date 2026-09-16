---
'@mastra/playground-ui': patch
---

Replaced the trace filters in Studio (Traces, agent traces, and workflow traces) with the typeahead FilterBar. Filters are now added by typing field → operator → value in one input and appear as inline editable chips; "Clear filters" removes them all. The time range now lives in the same bar as an always-present `Time is …` chip (defaulting to Last 7 days) that opens the usual preset / custom-range picker. Scoped views keep their Primitive Type and Primitive ID chips read-only. Existing filter URLs keep working. The Columns button is now a ghost button.

**Also added**

- `hidden` flag on `FilterBarField` so a field can be excluded from the FilterBar input's field step while chips for it still render.
- `removable` prop on `FilterBar.Chip` (default `true`) — when `false` the chip has no remove button and ignores Backspace/Delete.
- `renderTrigger` prop on `DateTimeRangePicker` to render a custom trigger for the preset menu.
