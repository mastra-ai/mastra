---
'@mastra/core': minor
'mastracode': patch
---

Moved the run-control surface off the Harness onto the `Session`. Sending messages and signals, steering, following up, aborting, responding to tool suspensions, and saving system reminders now live on the session that owns the run state they drive, instead of being delegated through the Harness. This is the final step of the single-session extraction series and a prerequisite for the upcoming multi-session (`createSession`) work: every per-session operation now lives on `Session`, while the Harness retains only genuinely shared machinery (agent, config builders, storage/lock gateway), which it injects into each session via the `SessionMachinery` provider.

**Before**

```typescript
await harness.sendMessage({ content: 'hello' });
harness.sendSignal({ content: 'steer the run' });
harness.abort();
await harness.respondToToolSuspension({ toolCallId, approved: true });
```

**After**

```typescript
const session = await harness.createSession();
await session.sendMessage({ content: 'hello' });
session.sendSignal({ content: 'steer the run' });
session.abort();
await session.respondToToolSuspension({ toolCallId, approved: true });
```

Removed `Harness.sendMessage`, `Harness.sendSignal`, `Harness.sendNotificationSignal`, `Harness.steer`, `Harness.followUp`, `Harness.abort`, `Harness.respondToToolSuspension`, `Harness.saveSystemReminderMessage`, and `Harness.waitForCurrentThreadStreamIdle`. The `Session` reaches Harness-owned machinery through the injected `SessionMachinery` provider, so the heavy run loop is still constructed and owned by the Harness while being parameterized by the session it runs on.

`mastracode` is updated to consume the new API: the TUI run loop, slash-command dispatch, goal lifecycle, prompt handlers, and headless entry points all drive run-control through the session returned by `harness.createSession()`.
