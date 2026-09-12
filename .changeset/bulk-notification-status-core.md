---
'@mastra/core': minor
---

Added `NotificationsStorage.updateNotificationsStatus()` to set one status on many notifications of a thread in a single write. The notification inbox tool now uses it to mark a viewed page seen with one round-trip instead of one update per record.

```ts
// Before: one write per notification
await Promise.all(ids.map(id => storage.updateNotification({ threadId, id, status: 'seen' })));

// After: one write for the whole page; returns the updated records
const seen = await storage.updateNotificationsStatus({ threadId, ids, status: 'seen' });
```

Adapters that don't override the method fall back to per-record `updateNotification` calls, so existing custom storages keep working.
