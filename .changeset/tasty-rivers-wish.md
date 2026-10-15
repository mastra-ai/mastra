---
'@mastra/playground-ui': minor
---

Added an Output column to the Traces table, so you can see what a run returned without opening it.

- Shows the trace's output preview, or its error in red when the trace failed.
- On by default, next to Input. Hide it from the Columns menu or through `columnPreferences`.
- Saved column choices gain Output next to Input when Input is shown.
- Servers that don't send previews show `-`.

```tsx
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '@mastra/playground-ui/domains/traces/trace-list-columns';

<TracesListView
  {...props}
  columnPreferences={{
    ...DEFAULT_TRACE_COLUMN_PREFERENCES,
    visibleColumns: DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns.filter(column => column !== 'output'),
  }}
/>;
```
