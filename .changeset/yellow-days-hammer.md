---
'@mastra/memory': minor
---

Made Observational Memory recall guidance scope-aware and added support for appending custom recall instructions.

With `retrieval.scope: "resource"`, the injected instructions now teach the agent how to route between `mode: "search"`, `mode: "threads"`, and `mode: "messages"` — including falling back to thread discovery when search results are irrelevant, since a short or recent thread may exist in raw message history before any observation of it was created. Resource-scoped recall guidance is now also injected before the first observation group exists, so the agent can browse other threads from the very first message of a conversation.

Applications can now append recall-specific guidance after Mastra's built-in instructions without replacing them:

```ts
observationalMemory: {
  retrieval: {
    vector: true,
    scope: 'resource',
    instructions: 'Prefer the current conversation when it already contains the answer.',
  },
},
```

Omitting `instructions` keeps existing behavior. Fixes https://github.com/mastra-ai/mastra/issues/19561
