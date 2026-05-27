---
'@mastra/editor': patch
---

Added optional constructor argument support to `createBuilderAgent()` so callers can override agent defaults while the canonical `id`, `name`, and `description` are preserved.

```ts
// Before — could only use the built-in defaults
const builder = createBuilderAgent();

// After — pass overrides while keeping the canonical identity
const builder = createBuilderAgent({
  model: openai('gpt-4o'),
  instructions: 'Custom instructions for this deployment',
});
```
