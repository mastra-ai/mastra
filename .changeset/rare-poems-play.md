---
'@mastra/core': minor
'mastracode': patch
---

Added message queuing support to the Harness primitive. New messages sent while the agent is running can now be either interrupted (default) or queued for processing after the current generation completes.

**New API:**

- `send({ content })` — auto-routes based on the delivery mode: sends immediately when idle, interrupts or queues when running
- `getMessageDeliveryMode()` — returns the current mode (`'interrupt'` | `'queue'`)
- `setMessageDeliveryMode({ mode })` — switch between interrupt and queue behavior
- New `message_delivery_mode_changed` event emitted when the mode changes
- `messageDeliveryMode` added to `HarnessDisplayState`

```typescript
// Switch to queue mode so new messages wait for the current generation
harness.setMessageDeliveryMode({ mode: 'queue' });

// This will queue instead of interrupting
await harness.send({ content: 'Do this next' });

// Switch back to interrupt mode (default)
harness.setMessageDeliveryMode({ mode: 'interrupt' });
```
