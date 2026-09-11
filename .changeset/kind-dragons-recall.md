---
'@mastra/core': minor
---

Added `hideSignals` to the core memory recall contract so memory implementations and callers can explicitly control which stored signal messages are returned. Omitted exclusions preserve the existing reminder-hidden history default, and explicit visibility settings take precedence over the deprecated `includeSystemReminders` option.

```ts
await memory.recall({ threadId: 'thread-1', hideSignals: false });
await memory.recall({ threadId: 'thread-1', hideSignals: true });
await memory.recall({
  threadId: 'thread-1',
  hideSignals: ['reactive', 'system-reminder'],
});
```

Use `true` to hide all recognized signal types, `false` or `[]` to include all, or an array to hide selected exact stored types. Legacy reminder rows without a recognized encoded signal type match `system-reminder`. Returned-message filtering preserves pagination totals, raw storage, ordinary messages, and model context.
