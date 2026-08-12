---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Typed the background observational-memory flags the server already sends on `display_state_changed`, so clients can read them without casting:

```ts
client.agentController(id).streamSession(resourceId, event => {
  if (event.type !== 'display_state_changed') return;
  // both are now typed as `boolean | undefined`
  const { bufferingMessages, bufferingObservations } = event.displayState;
});
```

`bufferingMessages` is true while a buffered observation runs, `bufferingObservations` while a buffered reflection runs.
