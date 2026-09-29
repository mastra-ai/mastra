---
'@mastra/code-sdk': minor
---

Added `@mastra/code-sdk/schedules` with a process-local `ThreadScheduler` that sends recurring prompts into a thread on wall-clock boundaries, following daylight saving changes like cron.

```ts
scheduler.create(
  { prompt: 'Check whether the build is green', trigger: { kind: 'every', interval: { ms: 5 * 60_000, label: '5m' } } },
  { threadId, resourceId },
);
```

A schedule's source is a prompt, a prompt file re-read on each fire, or a script whose output becomes the prompt. `run()` reports whether a manual fire was delivered, failed, skipped because it was already firing, or not found. The Mastra Code controller exposes the scheduler as `threadScheduler`, and `createScheduleTools()` builds agent tools for it, enabled with the `scheduleTools` config option or the `signals.experimentalScheduleTools` setting (off by default).
