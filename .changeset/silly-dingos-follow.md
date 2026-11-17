---
'@mastra/factory': minor
---

Fixed Factory server memory growing with every session it ever opened. Factory now unloads a session from server memory when it stops the session's sandbox (a card leaving a phase's context or finishing), and after 30 minutes without activity. Sessions that are running, waiting on an approval or answer, open in a browser tab, or running a background process in their sandbox stay loaded. Unloading keeps the thread, its messages, the session row and the sandbox, and the session's next message, run, wake or opened tab loads it again. Without `auth`, a deferred wake for an unloaded session waits until something else loads it, as it does after a restart.

Change the timeout with `idleSessionUnload`, or pass `false` to keep every session loaded:

```ts
const factory = new MastraFactory({
  storage,
  idleSessionUnload: { idleMs: 60 * 60_000, sweepIntervalMs: 5 * 60_000 },
});
```
