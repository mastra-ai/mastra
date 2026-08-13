---
'@mastra/client-js': minor
---

Declared `bufferingMessages` and `bufferingObservations` on the `display_state_changed` event, which the server has been sending all along. They say which memory budget a background pass is working on, so a client can show that work on the budget it acts on instead of as one shared label.

```ts
client.agentController(id).streamSession(resourceId, event => {
  if (event.type !== 'display_state_changed') return;
  // A buffered observation is running: the message window is being read into memory.
  // A buffered reflection is running: observations are being consolidated.
  const { bufferingMessages, bufferingObservations } = event.displayState;
});
```
