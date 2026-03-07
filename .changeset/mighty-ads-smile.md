---
'@mastra/core': minor
---

Added message queuing to the Harness. When the agent is running, new messages are now queued by default and processed after the current generation completes. You can switch to interrupt mode to abort and resend instead.

**Why:** Previously, sending a message while the agent was running always interrupted the current generation. Now you can queue messages so nothing is lost — hit Escape to stop the current response and the next queued message starts automatically.

```typescript
// Queue is the default — this queues while the agent is running
await harness.send({ content: 'Do this next' });

// Switch to interrupt mode if you want the old abort-and-resend behavior
harness.setMessageDeliveryMode({ mode: 'interrupt' });

// Check or react to the current mode
const mode = harness.getMessageDeliveryMode(); // "queue" | "interrupt"
harness.subscribe(event => {
  if (event.type === 'message_delivery_mode_changed') {
    console.log(event.mode);
  }
});
```
