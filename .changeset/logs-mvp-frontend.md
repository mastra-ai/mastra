---
'@mastra/playground-ui': patch
'mastra': patch
---

**Logs MVP — Studio frontend**

- **Logs page**: New `/logs` route with paginated log list, date preset filtering, text search, and column-based filter groups via the new `SelectDataFilter` component.
- **Log details panel**: Expandable detail view showing log message, trace/span navigation buttons, key-value metadata, and code sections for structured data.
- **Span details panel**: Key-value span info (type, timestamps, duration) with collapsible code sections for input/output/metadata/attributes.
- **Trace details panel**: Hierarchical trace timeline with expandable spans, timing bars, span type icons, and search-to-highlight.
- **New DS components**:
  - `DataDetailsPanel` — composable detail panel with header, key-value list, code sections, loading/empty states.
  - `DataList` — generic data list with row links, top cells, skeleton loading, and pagination support.
  - `LogsDataList` — log-specific data list cells (level, date, time, entity, message, data).
  - `SelectDataFilter` — dropdown-based multi-category filter with search, single/multi selection modes, and active filter count badge.
- **ListSearch**: Now accepts `size` prop (derived from `InputProps`) passed through to `SearchFieldBlock` and `Input`.
- **Sidebar**: Added Logs link under the Observability section (experimental feature flag).
