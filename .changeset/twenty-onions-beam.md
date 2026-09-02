---
'@mastra/core': minor
---

Added an opt-in `delegation.enableResultReferences` option, so a parent agent can pass one subagent's result to another by reference instead of restating it.

It's off by default. Turning it on adds a `contextFromRefs` field to each subagent tool and a `[ref: <id>]` line to every delegation result, so existing supervisors keep the tool surface and model context they have today until you ask for the change.

**Why:** Subagents can't see each other's work. The parent forwards its conversation to each subagent, but tool calls and tool results are stripped first, and a subagent's response reaches the parent as a tool result. The only way to pass findings onward was for the parent model to retype them, which costs output tokens on every delegation and rewords the details.

Every delegation result now carries a `ref` id, which the parent model sees as a `[ref: <id>]` line after the response text. Passing that id on a later delegation inserts the referenced text into that subagent's prompt, inside a block that names its source.

**Before**, the parent model had to restate the research it received:

```json
{
  "prompt": "Implement a fix. The research agent found that sessions live in src/auth/session.ts with a 30 minute window, refresh happens around line 88, and the retry wrapper swallows 401 errors. Use strict TypeScript."
}
```

**After**, with the option enabled, it references the earlier result and writes only its own instructions:

```typescript
await parentAgent.generate('Fix the expired-session bug', {
  delegation: { enableResultReferences: true },
});
```

```json
{
  "prompt": "Implement a fix. Use strict TypeScript.",
  "contextFromRefs": ["researchAgent-1"]
}
```

Each entry accepts a bare id, or an object that adds a label and a caveat:

```json
{
  "contextFromRefs": [
    { "ref": "authAgent-1", "as": "auth findings" },
    { "ref": "dbAgent-2", "as": "database findings", "note": "ignore section 3" }
  ]
}
```

References resolve only to delegations made during the same parent run. Unresolved references stay visible in the prompt instead of being dropped.
