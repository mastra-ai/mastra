---
'@mastra/core': minor
---

Added event numbering to agent controller sessions. Each event a session emits now has a `seq` one higher than the last, so a subscriber can tell when it missed events. Listeners receive it as a second argument, and `session.lastEventSeq` gives the number of the last event.

```ts
let last: number | undefined;
session.subscribe((event, seq) => {
  if (last !== undefined && seq !== undefined && seq > last + 1) {
    // events were missed: re-read the thread
  }
  last = seq;
});
```
