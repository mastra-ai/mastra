---
'@mastra/client-js': minor
---

Corrected the observational-memory progress typing on `display_state_changed`, which described the session-state route's shape rather than the one the event stream actually carries. The event sends the buffered passes; the route sends the projections already flattened out of them. Both are now declared, and the flattened pair is optional because it only exists on the route. `status` is typed as the union the server sends rather than a bare `string`, so a typo in a comparison fails to compile.

```ts
client.agentController(id).streamSession(resourceId, event => {
  if (event.type !== 'display_state_changed') return;
  const om = event.displayState.omProgress;
  // What a pending observation will free, straight off the event.
  const freed = om?.buffered?.observations.projectedMessageRemoval ?? 0;
  // Typed too, instead of needing a cast.
  const { bufferingMessages, bufferingObservations } = event.displayState;
});
```

`bufferingMessages` is true while a buffered observation runs, `bufferingObservations` while a buffered reflection runs. Reading `projectedMessageRemoval` or `projectedReflectionSavings` off a stream event now fails to compile instead of silently landing `undefined` at runtime.
