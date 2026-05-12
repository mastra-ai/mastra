---
'mastracode': minor
---

Added signal-based follow-up support for Mastra Code.

Text submitted while an agent run is active now continues the current thread, shows as pending until the signal echo confirms it, and avoids duplicate stream rendering by following thread output through one subscription owner.

For example, pressing `Ctrl+F` while the agent is streaming queues the editor contents as a follow-up signal instead of waiting for the run to finish:

```ts
const signal = harness.sendSignal({ content: 'one more constraint: keep the fix minimal' });
await signal.accepted;
```
