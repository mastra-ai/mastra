---
'@mastra/memory': minor
---

Added `excludeSignals` to `memory.recall()` so callers can choose which stored signal types to omit without altering saved messages or model context. Deprecated `includeSystemReminders`; omitted exclusions preserve existing history defaults.

```ts
// Before: include all reminders through the legacy flag.
await memory.recall({ threadId: 'thread-1', includeSystemReminders: true });
// Now: an explicit list takes precedence over that flag, including an empty list.
await memory.recall({ threadId: 'thread-1', excludeSignals: [] });
await memory.recall({
  threadId: 'thread-1',
  excludeSignals: ['reactive', 'system-reminder'],
});
```

Unlike modern streams, recall matches stored types exactly. Legacy reminder rows without recognized signal types match `system-reminder`. Filtering preserves pagination totals and never changes ordinary messages. HTTP/client-js options are unchanged.
