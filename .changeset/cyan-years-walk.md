---
'@mastra/memory': minor
---

Added `hideSignals` to `memory.recall()` so callers can choose which stored signal types to omit without altering saved messages or model context. Deprecated `includeSystemReminders`; omitted exclusions preserve existing history defaults.

```ts
// Before: include all reminders through the legacy flag.
await memory.recall({ threadId: 'thread-1', includeSystemReminders: true });
// Now: any explicit visibility setting takes precedence over that flag.
await memory.recall({ threadId: 'thread-1', hideSignals: false });
await memory.recall({ threadId: 'thread-1', hideSignals: true });
await memory.recall({
  threadId: 'thread-1',
  hideSignals: ['reactive', 'system-reminder'],
});
```

Use `true` to hide all recognized signals, `false` or `[]` to include all, or an array to select types. Unlike modern streams, recall matches stored types exactly. Legacy reminder rows without recognized signal types match `system-reminder`. Filtering preserves pagination totals and never changes ordinary messages. HTTP/client-js options are unchanged.
