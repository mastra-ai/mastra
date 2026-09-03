---
'@mastra/code-sdk': minor
---

Added native background tool and delegated subagent support to Mastra Code sessions.

Read-only workspace tools and the Alexandria expert are background-eligible but remain foreground by default. Agents can opt individual calls into `deferred` or `awaited` execution through the Core `_background.disposition` override.

Mastra Code factory results now expose `backgroundCompletionEvents`, which publishes reconciled `completed`, `failed`, and `cancelled` events for the originating resource and thread:

```ts
const mastraCode = await createMastraCode(options);

const unsubscribe = mastraCode.backgroundCompletionEvents.subscribe(event => {
  console.log(event.taskId, event.status);
});
```
