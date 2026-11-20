---
'@mastra/playground-ui': minor
---

The spans and threads pages now render from data you hand them, like the traces page. `SpansExplorerBody`, `ThreadsExplorerBody`, their filter bars, the spans histogram and `ColumnsMenu` no longer fetch: they take records typed with the `@mastra/client-js` response types and report every action through a callback. An app with its own transport, for example an MCP server app, can show the same pages from its own queries.

Studio loads the same data through the new `useSpansExplorer` and `useThreadsExplorer` hooks, so its pages look and behave as before.

```tsx
// Before
<SpansExplorerBody
  urlState={urlState}
  selection={selection}
  onSelectionChange={setSelection}
  renderPanel={renderPanel}
/>;

// After
import { useSpansExplorer } from '@mastra/playground-ui/domains/spans/hooks/use-spans-explorer';

const explorer = useSpansExplorer(urlState);

<SpansExplorerBody {...explorer} selection={selection} onSelectionChange={setSelection} renderPanel={renderPanel} />;
```

**Threads:** `ThreadsExplorerBody` no longer draws the thread drawer itself. Pass `renderPanel` and draw your own; `onOpenScore` moved to that drawer.

```tsx
const explorer = useThreadsExplorer(urlState);

<ThreadsExplorerBody
  {...explorer}
  selectedThreadId={threadId}
  onSelectedThreadChange={setThreadId}
  renderPanel={({ threadId, onClose }) => (
    <TraceThreadPanel threadId={threadId} onOpenScore={openScore} onClose={onClose} />
  )}
/>;
```

**Columns menu:** `ColumnsMenu` takes a `support` prop (`isLoading`, `withQuery`, `withTimeToFirstChunk`, `withTimeToFirstToken`) and an optional `metadataKeys` list instead of reading capabilities and field discovery.

`compareSpans` and `compareThreads`, the sort orders Studio uses to merge newly polled rows into a list, are exported from `domains/spans/hooks/use-spans-list-source` and `domains/threads/hooks/use-threads-list-source`, so a host polling its own transport can merge rows the same way.
