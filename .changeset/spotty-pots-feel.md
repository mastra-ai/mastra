---
'@mastra/playground-ui': minor
---

The trace thread view now reads like a chat. It opens on the latest turns, stays on the newest turn while messages and spans load, and loads older turns as you scroll up without moving what you are reading. It now searches the last 31 days of traces, up from 30 (no limit when trace query is unavailable), and the new `pageSize` prop sets how many turns load at a time (default 10).

**Breaking:** `anchorTraceId` was removed from `ThreadViewByTrace`, `TraceThreadPanel` and `ThreadTrace`, and `ThreadTrace.LoadMoreSentinel` was removed. Pass `onLoadOlder` to `ThreadTrace` to load older turns.

```tsx
// Before
<ThreadViewByTrace threadId={threadId} anchorTraceId={traceId} />

// After
<ThreadViewByTrace threadId={threadId} pageSize={20} />
```
