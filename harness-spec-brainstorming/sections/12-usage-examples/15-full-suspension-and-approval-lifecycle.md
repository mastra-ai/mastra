### 12.15 Full suspension and approval lifecycle

This example walks through every interruption shape end-to-end: **tool approval**, **mid-execution suspension**, **a question raised by `ask_user`**, and **a `submit_plan` approval gate** — including a server crash midway through and a clean resume on a different process.

The point is to show that all four shapes use the same pending-item and response
flow. §4.2 owns the response methods and Required Agent Resume Boundary; §5.1
owns the persisted pending-item, receipt, and workflow snapshot shapes.

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
      const { approved, reason, rememberCategory } = await ui.askApproval({
        toolName: event.toolName,
        input: event.input,
        category: event.toolCategory,
      });
      if (approved && rememberCategory && event.toolCategory) {
        await session.permissions.grantCategory({ category: event.toolCategory });
      }
      await session.respondToToolApproval({
        itemId: event.itemId,
        approved,
        reason,
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
      // Direct in-process call: wire/webhook callers must also provide responseId.
      await session.respondToToolSuspension({
        itemId: event.itemId,
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
      await session.respondToQuestion({ itemId: event.itemId, answer });
      break;
    }

    case 'plan_approval_required': {
      // `submit_plan` was invoked. Approval flips the session into build mode.
      const { approved, reason } = await ui.reviewPlan({
        title: event.title,
        plan: event.plan,
      });
      await session.respondToPlanApproval({ itemId: event.itemId, approved, reason });
      break;
    }
  }
});

// Kick off a turn that will exercise all four shapes.
session.queue({
  content: 'Refactor the billing service. Plan first, ask before destructive changes.',
});

// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
// Behind the scenes, each interruption persists the pending item and resumes
// through the same §4.2/§5.1 boundary. If the server dies while a pending item
// is waiting on a human or webhook, the next process rehydrates that state:
// ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

// Different process — server restarted.
const harness2 = new Harness(config);
await harness2.init();

const session2 = await harness2.session({ sessionId: 'session-abc', resourceId: 'user-123' });

// Display state has been rehydrated from the SessionRecord — the pending plan
// is still there, untouched.
const display = session2.getDisplayState();
if (display.pendingPlan) {
  const { approved } = await ui.reviewPlan({
    title: display.pendingPlan.title,
    plan: display.pendingPlan.plan,
  });
  // In-process direct call: the harness mints responseId internally. External
  // callers must provide both itemId and responseId.
  await session2.respondToPlanApproval({
    itemId: display.pendingPlan.itemId,
    approved,
  });
}
```

For the persisted/transient boundary across suspension and crash recovery, use
§5.1 and §5.7 as the source of truth. If the human never returns, use the §5.5
close lifecycle to dispose of the pending work; multi-tenant code passes the
trusted `resourceId`, as in
`harness.closeSession({ sessionId: 'session-abc', resourceId: 'user-123' })`.
