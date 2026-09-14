---
'@mastra/core': minor
---

Restored reactive and system-reminder signals in live streams by default. Added caller-local `hideSignals` to modern agent streams, resume/until-idle streams, and thread subscriptions. Exclusions leave model context, persistence, transforms, and other subscribers unchanged.

```ts
// Before: reminders were hidden from every live consumer.
const output = await agent.stream('Continue');
// Now: reminders are visible by default; opt out for this caller only.
const filtered = await agent.stream('Continue', {
  hideSignals: ['reactive', 'system-reminder'],
});
const subscription = await agent.subscribeToThread({
  threadId: 'thread-1',
  resourceId: 'user-1',
  hideSignals: ['reactive'],
});
```

Set `hideSignals: true` to hide all recognized signals, `false` or `[]` to show all, or an array to hide selected types. Stream exclusions normalize legacy aliases. They filter streamed signal chunks after transforms, not aggregate output, and are not a security boundary. Shared execution options also accept `hideSignals` on `generate()` and `resumeGenerate()` without filtering their returned results. HTTP/client-js options are unchanged.

Fixed directory-scoped instruction discovery so completed file operations load the nearest `AGENTS.md` into the next model request. Repeated operations in the same directory no longer load duplicate instructions, aliased paths resolve to the same instructions, and operations with multiple path fields can discover instructions for each destination.
