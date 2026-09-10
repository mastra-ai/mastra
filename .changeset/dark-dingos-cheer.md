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

Stream exclusions normalize legacy aliases. They filter streamed signal chunks after transforms, not aggregate output, and are not a security boundary. Shared execution options also accept `hideSignals` on `generate()` and `resumeGenerate()` without filtering their returned results. HTTP/client-js options are unchanged.

Fixed directory instruction discovery after tool results move between message tracking sets. Completed results are searched newest-first, continuing past covered path fields to uncovered destinations; observational memory is unchanged. Local filesystem aliases now deduplicate against static and persisted instructions. Custom `ReminderFileReader` implementations can provide `getPathIdentity(path)` for comparison without rewriting read addresses or emitted paths; readers without it retain lexical identity.
