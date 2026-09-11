---
'@mastra/core': minor
---

Added `delegation.enableResultReferences` so a later subagent delegation can reuse an earlier subagent's result verbatim, instead of the supervisor restating it. When enabled, each successful foreground subagent result ends with a `[ref: <id>]` line (for example `explorer-1`), and every delegation tool gains a `contextFromRefs` input that inserts the referenced results ahead of the prompt. Rejected, failed, empty, and background-task delegations don't get a reference. Off by default; when it's off the tool schemas and model output are unchanged.

```ts
const supervisor = new Agent({
  id: 'supervisor',
  instructions: 'Delegate research to explorer, then hand the findings to implementer.',
  model: 'openai/gpt-5',
  agents: { explorer, implementer },
});

await supervisor.generate('Find and fix the token refresh bug', {
  delegation: { enableResultReferences: true },
});
// 1. agent-explorer  → "...expiry check uses `<` instead of `<=`.\n\n[ref: explorer-1]"
// 2. agent-implementer({ prompt: 'Fix the bug', contextFromRefs: ['explorer-1'] })
//    receives the explorer's text verbatim before the prompt.
```

Referenced text is subagent output. If subagents handle untrusted input, validate or rewrite `resultText` in `onDelegationComplete` (or through processors) before it can be referenced. Closes https://github.com/mastra-ai/mastra/issues/22910
