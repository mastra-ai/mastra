### 12.17 Goals (Ralph loop)

Drive a session toward a long-horizon objective using a separate judge model.
§4.7 owns the goal lifecycle, continuation, budget, and judge-failure rules.

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
await session.setGoal({
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
await session.pauseGoal();
await session.message({ content: 'Quick — what does line 42 of pricing.ts do?' });
await session.resumeGoal();

// Done.
await session.clearGoal();
```

For canonical goal behaviors, including continuation queueing, stale judge
results, budget exhaustion, and judge failure handling, see §4.7.

---
