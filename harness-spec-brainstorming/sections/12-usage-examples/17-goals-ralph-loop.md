### 12.17 Goals (Ralph loop)

Drive a session toward a long-horizon objective using a separate judge model. The user can interject at any time — their input preempts the next continuation cleanly because continuations land in the queue, not inline.

```ts
const session = await harness.session({ resourceId: 'user-123' });

// Render goal/judge state in the UI.
session.subscribe((event) => {
  switch (event.type) {
    case 'goal_set':
      ui.statusLine.set(`goal: ${event.goal.objective}`);
      break;
    case 'goal_judged':
      ui.statusLine.set(
        `judge ${event.turnsUsed}/${event.maxTurns} — ${event.decision.decision}`,
      );
      break;
    case 'goal_done':
      ui.toast(`goal done after ${event.turnsUsed} turns: ${event.reason}`);
      break;
    case 'goal_paused':
      ui.toast(`goal paused (${event.reason})`);
      break;
  }
});

// Kick off the Ralph loop. The judge model sees the conversation context
// after every assistant turn and decides done / continue / waiting.
session.setGoal({
  objective:
    'Refactor the billing service to use the new pricing engine. Run tests after each step and stop when CI passes locally.',
  judgeModel: 'anthropic/claude-haiku-4-5',
  maxTurns: 50,
  judgeAnswersQuestions: true, // judge auto-answers `ask_user` prompts so the loop stays autonomous
});

// First turn — the model starts working. After it finishes, the harness
// invokes the judge. If the judge says `continue`, the harness enqueues the
// continuation reason as the next message via session.queue(...).
await session.message({ content: 'Begin.' });

// User changes their mind mid-loop. The next continuation will run AFTER
// this message, because user input always preempts auto-continuations.
await session.message({ content: 'Actually, focus on the proration bug first.' });

// Pause without losing the goal — useful for triaging an unrelated bug.
session.pauseGoal();
await session.message({ content: 'Quick — what does line 42 of pricing.ts do?' });
session.resumeGoal();

// Done.
session.clearGoal();
```

**Important behaviours:**

- Continuations are queued, not inlined. A typed-ahead `queue(...)` item still runs before the next continuation.
- A `message(...)` posted while the judge is mid-evaluation is accepted normally; the judge's eventual `continue` reason is appended after that user message in the queue.
- If the goal is cleared or replaced while the judge is still running, the judge's result is dropped silently.
- Budget exhaustion (`turnsUsed >= maxTurns`) pauses the goal with `reason: 'budget_exhausted'`; raise the cap and call `resumeGoal()` to keep going.
- Judge failures pause the goal with `reason: 'judge_failed'` and emit an `error` event. No silent retry loop.

---
