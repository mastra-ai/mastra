---
'@mastra/playground-ui': minor
---

Added `ThreadsListView`, a list with one row per conversation, identified by its thread ID. `TraceThreadPanel` now accepts `closeLabel` for when the panel opens on its own instead of above a trace.

```tsx
import { ThreadsListView } from '@mastra/playground-ui/domains/traces/components/threads-list-view';

<ThreadsListView threadIds={['thread-1', 'thread-2']} onThreadClick={threadId => openThread(threadId)} />;
```
