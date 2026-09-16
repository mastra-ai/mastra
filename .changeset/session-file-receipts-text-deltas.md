---
'@mastra/core': minor
---

Added file-bearing Session commands with exact delivery receipts and optional run IDs on existing assistant text updates. Incremental consumers can match new answer text to an accepted run before it finishes.

```ts
const unsubscribe = session.subscribe(event => {
  if (event.type === 'message_update' && event.event.type === 'text-delta') {
    console.log(event.runId, event.id, event.event.delta);
  }
});
const delivery = session.sendMessageWithReceipt({
  content: 'Summarize the notes.',
  files: [{ data: 'Meeting notes', mediaType: 'text/plain', filename: 'notes.txt' }],
});
const accepted = await delivery.accepted;
console.log(accepted.runId, accepted.action);
```

Subscribe before sending because text can arrive before acceptance resolves. Delivery acceptance isn't run completion. Existing `sendMessage` and display events keep their behavior.
