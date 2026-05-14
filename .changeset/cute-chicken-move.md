---
'@mastra/core': minor
'@mastra/libsql': patch
---

Added `@mastra/core/tools/builtin` — four ready-to-use tools that suspend the agent loop for interactive flows.

```ts
import { askUser, submitPlan, taskWrite, taskCheck } from '@mastra/core/tools/builtin';

const agent = new Agent({
  name: 'planner',
  model: 'openai/gpt-4o-mini',
  instructions: '...',
  tools: { askUser, submitPlan, taskWrite, taskCheck },
});
```

- **askUser** pauses the agent and asks the user a question. The agent resumes with the user's answer.
- **submitPlan** pauses the agent and submits a plan for approval. The agent resumes with `{ approved, revision?, transitionToMode? }`.
- **taskWrite** writes a task list onto the current thread's metadata.
- **taskCheck** reads the task list back and reports counts + completion status.

The tools work with any Mastra agent. When used inside a Harness session, `askUser` and `submitPlan` are recognized as typed interrupts: callers resume them with `session.respondToQuestion({ answer })` and `session.respondToPlanApproval({ approved, revision?, transitionToMode? })` respectively. `respondToPlanApproval` now accepts `revision` and `transitionToMode` so the reviewer can attach guidance and override the mode's declared `transitionsTo` target.
