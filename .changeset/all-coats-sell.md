---
'@mastra/playground-ui': minor
---

Added what a host needs to keep the traces explorer's setup in a saved view:

- `TracesExplorer` takes optional `columns` and `onColumnsChange`, so the host can own the columns shown, for example to keep them in a view. Without them, the explorer keeps its own columns in browser storage as before.
- `@mastra/playground-ui/domains/traces/trace-saved-views` turns what the explorer shows into a saved view's filters and settings and back (`toTraceViewContent`, `fromTraceViewContent`, `traceViewSettingsSchema`). A time range, sort or column this version doesn't know falls back to the default instead of dropping the view.

```tsx
const content = toTraceViewContent({ filters, sortDirection, columns });
const shown = fromTraceViewContent({ filters: view.filters, settings: traceViewSettingsSchema.parse(view.settings) });
```

Fixed trace filters on servers without the trace query API: filters their list endpoint supports, such as Run ID, are now applied, and filters it can't run (another field or operator, or an AND/OR group) are left out of the list request instead of being sent as a different filter.
