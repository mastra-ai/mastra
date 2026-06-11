---
"@mastra/core": minor
---

Made the `submit_plan` built-in tool agent-agnostic and removed the Harness plan-approval channel in favor of native tool suspension.

`submit_plan` now pauses through the same tool-suspension primitive used by every other interactive tool, so it works on any agent — not just inside a Harness. A plain Agent (e.g. in Studio or a customer app) can render the plan and resume the tool with `agent.resumeStream({ action, feedback })`. The Harness surfaces the pause through the generic `tool_suspended` event and resumes it with `respondToToolSuspension`; on approval it additionally switches to its default (execution) mode.

**Breaking changes**

- Removed `harness.respondToPlanApproval(...)`. Resume a submitted plan with `harness.respondToToolSuspension({ toolCallId, resumeData: { action, feedback } })`.
- Removed the `plan_approval_required` and `plan_approved` events. Listen for `tool_suspended` with `event.toolName === 'submit_plan'` and read `{ title, plan }` from `event.suspendPayload`.
- Removed `registerPlanApproval` from `HarnessRequestContext` and the `HarnessDisplayState.pendingPlanApproval` field. A suspended `submit_plan` now appears as `HarnessDisplayState.pendingSuspension` like any other suspended tool.

**Before**

```typescript
harness.subscribe(event => {
  if (event.type === 'plan_approval_required') {
    harness.respondToPlanApproval({ planId: event.planId, response: { action: 'approved' } })
  }
})
```

**After**

```typescript
harness.subscribe(event => {
  if (event.type === 'tool_suspended' && event.toolName === 'submit_plan') {
    const { title, plan } = event.suspendPayload as { title: string; plan: string }
    harness.respondToToolSuspension({ toolCallId: event.toolCallId, resumeData: { action: 'approved' } })
  }
})
```
