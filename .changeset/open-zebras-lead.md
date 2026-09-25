---
'@mastra/memory': patch
---

Deprecated Observational Memory `scope: 'resource'`. Resource scope works much worse than thread scope for prompt caching and for the agent's understanding of the conversation. Using it now logs a one-time warning, and the option is marked `@deprecated` in types and docs. A new knowledge and subconscious memory primitive for cross-thread memory is coming soon and will replace resource scope. Until then, remove `scope` to use the default thread scope and enable `retrieval` or resource-scoped working memory for cross-thread continuity.

```typescript
// Before
observationalMemory: { model: 'google/gemini-2.5-flash', scope: 'resource' }

// After
observationalMemory: { model: 'google/gemini-2.5-flash', retrieval: true }
```
