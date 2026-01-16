---
"@mastra/core": minor
---

feat: support dynamic functions returning model fallback arrays

Agents can now use dynamic functions that return entire fallback arrays based on runtime context. This enables:
- Dynamic selection of complete fallback configurations
- Context-based model selection with automatic fallback
- Flexible model routing based on user tier, region, or other factors

Example:
```typescript
const agent = new Agent({
  model: ({ requestContext }) => {
    const tier = requestContext.get('tier');
    if (tier === 'premium') {
      return [
        { model: 'openai/gpt-4', maxRetries: 2 },
        { model: 'anthropic/claude-3-opus', maxRetries: 1 }
      ];
    }
    return [{ model: 'openai/gpt-3.5-turbo', maxRetries: 1 }];
  }
});
```

**Fixes included:**
- Dynamic model fallbacks now properly inherit agent-level `maxRetries` when not explicitly specified
- `getModelList()` now correctly handles dynamic functions that return arrays

Closes #11951
