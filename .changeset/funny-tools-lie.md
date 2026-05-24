---
'@mastra/core': patch
---

**Priority + deadline on the durable queue.** Two optional scheduling hints on `Session.queue(...)` admissions:

- `priority` — higher values drain first. Defaults to 0; items without a priority behave exactly like before.
- `deadline` — epoch ms past which the item must not start. Items past their deadline are removed before they ever run; the original `queue(...)` promise rejects with `HarnessSessionCancelledError`, a new `queue_item_expired` event fires for audit consumers, and the queue admission receipt is marked `failed`.

Same-priority items keep FIFO order (oldest `enqueuedAt` wins).

```ts
// "Run this before everything else queued right now."
await session.queue({ content: 'incident hotfix', priority: 10 });

// "Don't bother starting this after 9am."
await session.queue({
  content: 'overnight CI repair',
  deadline: Date.parse('2026-05-25T09:00:00Z'),
});
```

No data migration — the new fields are optional and persist alongside the existing queue rows.
