---
'@mastra/core': patch
---

Fixed AgentController sessions pausing every tool call for approval and running a step's tool calls one at a time. Fixes #30131.

- Calls to tools the session's permission rules allow no longer pause the run. Only calls that need approval wait on an approval prompt, and `deny` calls are still declined.
- Tool calls in one step run concurrently when none of them needs approval or can suspend. Durable agents still run them one at a time unless the session's `yolo` state is on.
- Answering `ask_user` no longer turns off approval for the rest of the run.
- On durable and evented agents, answering a suspended tool call from another thread now returns once the resumed run ends. It used to never return. Fixes #30150.
- Runs on a thread the session no longer has open use that thread's permission rules. `session.resolveToolApproval(toolName, scope)` accepts a run's `RequestContext` as `scope` for this.
- When a run resumes after an approval, a function `requireToolApproval` is evaluated again for the step's calls that had not run yet, so a rule changed while the run waited applies to them.
- Controller runs set `toolCallConcurrency: { strategy: 'called' }`. A numeric `toolCallConcurrency` in the agent's `defaultOptions` is replaced by it; use `{ limit }` to keep your limit.

**Tools without a category**

A tool your `toolCategoryResolver` maps to `null` previously asked for approval. It is now always allowed, so `ask_user` asks its question without an approval prompt first. A tool the resolver leaves `undefined`, and every tool on a controller without a resolver, still asks. If your resolver returns `null` for tools that should ask, return a category instead:

```typescript
// Before: every tool other than delete_project asked for approval
toolCategoryResolver: toolName => (toolName === 'delete_project' ? 'execute' : null)

// After: return null only for tools that never need approval
toolCategoryResolver: toolName => (toolName === 'delete_project' ? 'execute' : 'other')
```

Allowed tools no longer emit `tool-call-approval` and `tool-call-resumed` chunks or store an approval on the tool part. Runs with `yolo` on already behaved this way.
