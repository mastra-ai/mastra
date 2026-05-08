### 12.15 Full suspension and approval lifecycle

This example walks through every interruption shape end-to-end: **tool approval**, **mid-execution suspension**, **a question raised by `ask_user`**, and **a `submit_plan` approval gate** — including a server crash midway through and a clean resume on a different process.

The point is to show that all four shapes are the same underlying mechanism: the agent's workflow snapshot is parked in `MastraStorage.workflows` keyed by `runId`, the session record carries the `runId` plus enough UX state to render the prompt, and `agent.resumeStream(...)` continues from the snapshot once the human answers.

```ts
import { Harness, HarnessSessionNotFoundError } from '@mastra/core/harness/v1';

const harness = new Harness(config);
await harness.init();

const session = await harness.session({
  resourceId: 'user-123',
  threadId: { fresh: true },
  sessionId: 'session-abc',
});

// One subscriber drives all interrupt UX.
session.subscribe(async (event) => {
  switch (event.type) {
    case 'tool_approval_required': {
      // Model wants to call a tool whose category resolves to 'ask'.
      // Render UI, wait for the human, respond.
      const decision = await ui.askApproval({
        toolName: event.toolName,
        input: event.input,
        category: event.toolCategory,
      });
      session.respondToToolApproval({
        toolCallId: event.toolCallId,
        decision,                          // 'approve' | 'decline' | 'always_allow_category'
      });
      break;
    }

    case 'tool_suspension_required': {
      // A long-running tool paused itself with `suspend(data)` and is
      // waiting for an out-of-band signal (e.g., a webhook landed).
      const resumeData = await ui.collectSuspensionResolution({
        toolName: event.toolName,
        suspendData: event.suspendData,
      });
      await session.respondToToolSuspension({
        toolCallId: event.toolCallId,
        resumeData,
      });
      break;
    }

    case 'question_pending': {
      // `ask_user` was invoked.
      const answer = await ui.ask({
        question: event.question,
        options: event.options,
        selectionMode: event.selectionMode,
      });
      session.respondToQuestion({ answer });
      break;
    }

    case 'plan_approval_required': {
      // `submit_plan` was invoked. Approval flips the session into build mode.
      const { approved, reason } = await ui.reviewPlan({
        title: event.title,
        plan: event.plan,
      });
      await session.respondToPlanApproval({ approved, reason });
      break;
    }
  }
});

// Kick off a turn that will exercise all four shapes.
session.queue({
  content: 'Refactor the billing service. Plan first, ask before destructive changes.',
});

// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// What happens behind the scenes:
//
//   1. Agent calls `submit_plan` → harness emits `plan_approval_required`,
//      persists `pendingPlan = { runId, toolCallId, title, plan, source: 'parent' }`
//      to the SessionRecord. Workflow snapshot lives in MastraStorage.workflows.
//      User clicks "approve" → harness calls `agent.resumeStream({ approved: true }, { runId })`.
//      Mode flips to 'build'.
//
//   2. Agent calls `mastra_workspace_execute_command('rm -rf packages/legacy/')`.
//      The `mutation` category resolves to 'ask' → harness emits
//      `tool_approval_required`, persists `pendingApproval`. User declines →
//      `agent.resumeStream({ approved: false }, { runId })` — model continues
//      without the tool result.
//
//   3. Agent calls `ask_user('Which billing provider?')` → `question_pending`,
//      persists `pendingQuestion`. User answers → resume continues.
//
//   4. Agent invokes a long-running tool that calls `suspend({ webhookUrl })`.
//      Harness emits `tool_suspension_required`, persists `pendingSuspension`.
//      External webhook posts result → `respondToToolSuspension(...)` resumes.
//
// Crash recovery: if the server dies after step 1's snapshot is written but
// before the user approves, the SessionRecord still holds the `pendingPlan`
// and `runId`. On the next process:
// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

// Different process — server restarted.
const harness2 = new Harness(config);
await harness2.init();

const session2 = await harness2.session({ sessionId: 'session-abc' });

// Display state has been rehydrated from the SessionRecord — the pending plan
// is still there, untouched.
const display = session2.getDisplayState();
if (display.pendingPlan) {
  const { approved } = await ui.reviewPlan({
    title: display.pendingPlan.title,
    plan: display.pendingPlan.plan,
  });
  // `respondToPlanApproval` looks up the persisted runId and calls
  // `agent.resumeStream(...)` — the conversation continues exactly where it
  // paused, even though we're in a fresh process.
  await session2.respondToPlanApproval({ approved });
}
```

**What's persisted vs. transient.** Across the suspension boundary:

| Layer | Persisted | Transient |
|---|---|---|
| Agent workflow snapshot | `MastraStorage.workflows[runId]` | — |
| UX prompt state | `SessionRecord.pendingApproval / pendingSuspension / pendingQuestion / pendingPlan` | — |
| Queue (typed-ahead) | `SessionRecord.pendingQueue` | — |
| Subscriber callbacks | — | rebuilt on `session.subscribe(...)` after rehydration |
| `AbortController`, in-flight promises | — | discarded on dehydration |

If the human never returns, the pending suspension stays parked in storage indefinitely. `harness.closeSession({ sessionId })` is the only operation that drops it (along with the workflow snapshot via cascade) — see §5.5.
