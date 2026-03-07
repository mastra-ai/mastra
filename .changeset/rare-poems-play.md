---
'@mastra/core': minor
'mastracode': patch
---

Added message queuing support to the Harness primitive. New messages sent while the agent is running are now queued by default and processed after the current generation completes. The delivery mode can be switched to interrupt if needed.

**New API:**

- `send({ content })` — auto-routes based on the delivery mode: sends immediately when idle, queues or interrupts when running
- `getMessageDeliveryMode()` — returns the current mode (`'queue'` | `'interrupt'`)
- `setMessageDeliveryMode({ mode })` — switch between queue (default) and interrupt behavior
- New `message_delivery_mode_changed` event emitted when the mode changes
- `messageDeliveryMode` added to `HarnessDisplayState`

```typescript
// Messages are queued by default while the agent is running
await harness.send({ content: 'Do this next' });

// Switch to interrupt mode to abort the current generation on send
harness.setMessageDeliveryMode({ mode: 'interrupt' });
```
