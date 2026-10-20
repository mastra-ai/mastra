---
'@mastra/memory': minor
---

Subconscious now reads and writes Knowledge in the scopes your run actually holds, instead of a fixed org → resource → thread chain.

- The org comes from the run's trusted agent scopes (an Agent's `scopes`), never from `requestContext.organizationId`. The `knowledgeResourceId` request-context override is removed: declare the scope type you want instead.
- Configure the scope types on Knowledge. For Memory's chain, spread the preset: `new Knowledge({ storage, scopes: memoryScopeTypes })`. A host can declare its own, for example org → project → thread, and Subconscious follows it.
- Thread scopes are now addressed `thread:<threadId>`, matching the agent scope.
- The curator's `scope` choices are named after the run's own levels. Pins default to the level above the thread and never go to the org.
- When Knowledge has no scope types matching the run, Subconscious fails closed with a clear error instead of writing anywhere.
