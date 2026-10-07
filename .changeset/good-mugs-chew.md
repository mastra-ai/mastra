---
'@mastra/playground-ui': minor
---

Added `ThreadsListView`, a list with one row per conversation showing its thread ID, agent, first and last message, resource ID, turn count, duration, and status. `TraceThreadPanel` now accepts `closeLabel` for when the panel opens on its own instead of above a trace.

```tsx
import { ThreadsListView } from '@mastra/playground-ui/domains/traces/components/threads-list-view';

<ThreadsListView
  threadIds={['thread-1', 'thread-2']}
  timeRange={{ from: '2026-10-01T00:00:00.000Z', to: '2026-10-07T00:00:00.000Z' }}
  onThreadClick={threadId => openThread(threadId)}
/>;
```
