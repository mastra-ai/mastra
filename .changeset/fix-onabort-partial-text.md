---
'@mastra/core': patch
---

fix(core): include partial text in onAbort event when stream is aborted mid-generation

Previously, the `onAbort` callback received `{ steps: [] }` with no accumulated text, causing callers to lose any partial response generated before cancellation.

**What changed**

- `llm-execution-step.ts`: both abort code paths now read `runState.state.textDeltas?.join('')` and pass the result as the `text` field in the abort event
- `types.ts`: `onAbort` callback type now reflects the optional `text` field: `(event: { steps: any[]; text?: string }) => Promise<void> | void`
