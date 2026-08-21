---
'@mastra/core': patch
---

Fixed `transient: true` signals so they deliver a single, fresh reminder instead of piling up.

`processInputStep` runs once per model call, not once per turn, so a processor that re-sends a transient reminder each step was adding a new copy each time — by the fifth step of a tool loop the model received five copies of the same `<system-reminder>`. `transient` only ever suppressed persistence, so it never bounded the number of in-prompt copies.

A transient signal now reuses one stable id per emitting processor and tag when the caller doesn't supply one, and re-sending it replaces the previous copy and moves it to the end of the prompt. That gives what the docs describe — one fresh copy near the latest message — with no caller changes.

```ts
export class SteeringReminderProcessor implements Processor {
  readonly id = 'steering-reminder';

  async processInputStep({ sendSignal }: ProcessInputStepArgs) {
    // Before: one copy per step (1, 2, 3, 4, 5 by the fifth step).
    // After:  one copy, always last.
    await sendSignal?.({
      type: 'reactive',
      contents: 'Stay on the current task and keep answers under three sentences.',
      transient: true,
    });
  }
}
```

**If you place your own prompt cache breakpoints:** exclude transient signals when choosing them. A transient signal is in the live prompt but never persisted, so the next turn reloads a history without it — if it sat inside a cached prefix, that prefix is invalidated at the turn boundary and you pay a full rebuild every turn. The outbound projection now marks these rows with `providerOptions.mastra.transient`, and `isTransientSignalMessage()` identifies them on a `MastraDBMessage`.

Passing an explicit `id` still wins, so send distinct ids when one processor needs several concurrent transient reminders under the same tag.
