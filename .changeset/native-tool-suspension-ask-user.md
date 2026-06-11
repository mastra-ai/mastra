---
"@mastra/core": minor
---

Made the `ask_user` built-in tool agent-agnostic and removed the Harness question channel in favor of native tool suspension.

`ask_user` now pauses through the same tool-suspension primitive used by every other interactive tool, so it works on any agent — not just inside a Harness. The Harness no longer has a separate question channel; instead it surfaces these pauses through the generic `tool_suspended` event and resumes them with `respondToToolSuspension`.

**Breaking changes**

- Removed `harness.respondToQuestion(...)`. Use `harness.respondToToolSuspension(...)` instead.
- Removed the `ask_question` event. Listen for `tool_suspended` and read the question from `event.suspendPayload`.
- Removed `registerQuestion` from `HarnessRequestContext`, the `HarnessDisplayState.pendingQuestion` field, and the `HarnessQuestionAnswer`, `HarnessQuestionOption`, and `HarnessQuestionSelectionMode` types.
- `HarnessDisplayState.pendingSuspension` (a single object or `null`) is now `HarnessDisplayState.pendingSuspensions`, a `Map` keyed by `toolCallId`. This lets the display state hold several parked prompts at once, so resuming one parallel `ask_user` no longer hides the others. Read a specific prompt with `displayState.pendingSuspensions.get(toolCallId)`.

`respondToToolSuspension` accepts an optional `toolCallId` so concurrently suspended tools (for example, parallel `ask_user` calls) can each be answered independently.

`harness.abort()` now clears any pending tool suspensions, so a run parked in a `suspend()` (e.g. an unanswered `ask_user`) can be aborted instead of staying parked forever. A new `harness.hasPendingSuspensions()` method reports whether the harness is awaiting a resume — useful because a suspended run nulls its internal abort controller, so `isRunning()` returns `false` while the run is still pending.

**Before**

```typescript
harness.subscribe(event => {
  if (event.type === 'ask_question') {
    harness.respondToQuestion({ questionId: event.questionId, answer: 'Yes' })
  }
})
```

**After**

```typescript
harness.subscribe(event => {
  if (event.type === 'tool_suspended' && event.toolName === 'ask_user') {
    const { question } = event.suspendPayload as { question: string }
    harness.respondToToolSuspension({ toolCallId: event.toolCallId, resumeData: 'Yes' })
  }
})
```
