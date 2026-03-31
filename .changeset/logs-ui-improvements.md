---
'@mastra/playground-ui': patch
---

**Logs UI improvements**

- Added `SelectDataFilter` dropdown component to the design system for reusable multi-category filtering with search, single/multi selection modes, and active filter count badge.
- Updated `LogsToolbar` with `SelectDataFilter` integration and a Reset button that appears when filters are active.
- Replaced custom `DetailRow` in log `SpanDetails` with `DataDetailsPanel.KeyValueList` for consistent key-value rendering.
- Improved `LogDetails` span button to disable when traceId is missing.
- Enabled line numbers and code folding in `DataDetailsPanelCodeSection` to match `SideDialogCodeSection` behavior.
- Fixed `bgColor` values in span type mapping to use valid CSS color strings.
