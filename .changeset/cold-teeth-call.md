---
'@mastra/client-js': patch
---

Fixed the agent controller event types to match what the server actually sends. `KnownAgentControllerEvent` is now derived from the wire type `@mastra/core` exports instead of a hand-written copy: the `display_state_changed` fields are no longer all optional, and the `error` event no longer claims its `error` may be a bare string. Runtime behavior is unchanged; only fallbacks written for those two type gaps become unnecessary.

```ts
// before
const running = event.displayState.isRunning ?? false;
const message = typeof event.error === 'string' ? event.error : event.error.message;

// after
const running = event.displayState.isRunning;
const message = event.error.message;
```
