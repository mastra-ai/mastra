---
'@mastra/core': patch
---

Added consumer groups to `UnixSocketPubSub`.

**Usage**

```typescript
// Every ungrouped subscriber receives each message.
await pubsub.subscribe('events', handleAllEvents);

// One subscriber in the group receives each message.
await pubsub.subscribe('events', handleWorkerEvent, { group: 'workers' });
```

**Behavior**

- Delivers each message once per named group and rotates delivery among available group members.
- Restores group membership when a client reconnects.
- Retries rejected local deliveries a bounded number of times.
