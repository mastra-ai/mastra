---
"@mastra/core": patch
---

Add support for `providerOptions` when defining tools. This allows developers to specify provider-specific configurations (like Anthropic's `cacheControl`) per tool.

```typescript
createTool({
  id: 'my-tool',
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } }
  },
  // ...
})
```
