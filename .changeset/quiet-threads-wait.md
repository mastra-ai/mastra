---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Fixed Mastra Code starting a second agent run on a thread that was already running in another project's Mastra Code process. Every local Mastra Code process shares one database, so any of them could pick up a notification meant for another project's thread, see that thread as idle, and run it with its own session and workspace.

Mastra Code processes now coordinate a thread's runs no matter which project they belong to, so a busy thread stays busy for every process, and a notification for a thread owned by another process waits for that process instead of running in the wrong one.

Notification delivery policies can return `hold: true` at delivery time to leave a notification pending for another process's dispatcher, without counting a delivery attempt:

```ts
const agent = new Agent({
  // ...
  notifications: {
    deliveryPolicy: {
      decide: async ({ record }) => (canRunHere(record.resourceId) ? undefined : { action: 'deliver', hold: true }),
    },
  },
});
```
