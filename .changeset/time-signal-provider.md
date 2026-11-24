---
'@mastra/core': minor
---

Added `TimeSignalProvider`, which keeps the current time in an agent's context as a `<current-time>` state signal. The model knows the time without a tool call, to the precision you choose.

```ts
import { TimeSignalProvider } from '@mastra/core/signals'

const agent = new Agent({
  // ...
  memory,
  signals: [new TimeSignalProvider({ interval: 'minute', timeZone: 'America/New_York' })],
})
```

The clock is read at each model step and a new snapshot is added only when the interval moves on, aligned to wall-clock boundaries by default. No timers run and idle threads are never woken. Each snapshot stays in the context, so a long run at `'minute'` carries one `<current-time>` message per minute it spans. Requires agent memory.
