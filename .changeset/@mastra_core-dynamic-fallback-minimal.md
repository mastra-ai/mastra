---
"@mastra/core": minor
---

feat: support dynamic functions returning model fallback arrays

Agents can now use dynamic functions that return entire fallback arrays based on runtime context. This enables:
- Dynamic selection of complete fallback configurations
- Context-based model selection with automatic fallback
- Flexible model routing based on user tier, region, or other factors
- Nested dynamic functions within returned arrays (each model in array can also be dynamic)

## Examples

### Basic dynamic fallback array
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

### Region-based routing with nested dynamics
```typescript
const agent = new Agent({
  model: ({ requestContext }) => {
    const region = requestContext.get('region');
    return [
      {
        model: ({ requestContext }) => {
          // Select model variant based on region
          return region === 'eu' ? 'openai/gpt-4-eu' : 'openai/gpt-4';
        },
        maxRetries: 2
      },
      { model: 'anthropic/claude-3-opus', maxRetries: 1 }
    ];
  },
  maxRetries: 1 // Agent-level default for models without explicit maxRetries
});
```

### Async dynamic selection
```typescript
const agent = new Agent({
  model: async ({ requestContext }) => {
    // Fetch user's tier from database
    const userId = requestContext.get('userId');
    const user = await db.users.findById(userId);

    if (user.tier === 'enterprise') {
      return [
        { model: 'openai/gpt-4', maxRetries: 3 },
        { model: 'anthropic/claude-3-opus', maxRetries: 2 }
      ];
    }
    return [{ model: 'openai/gpt-3.5-turbo', maxRetries: 1 }];
  }
});
```

## Technical Details

- Functions can return `MastraModelConfig` (single model) or `ModelWithRetries[]` (array)
- Models without explicit `maxRetries` inherit agent-level `maxRetries` default
- Each model in returned array can also be a dynamic function for nested selection
- Empty arrays are validated and throw errors early
- Arrays are normalized to `ModelFallbacks` with all required fields filled in
- Performance optimization: Already-normalized arrays skip re-normalization

## Fixes and Improvements

- Dynamic model fallbacks now properly inherit agent-level `maxRetries` when not explicitly specified
- `getModelList()` now correctly handles dynamic functions that return arrays
- Added validation for empty arrays returned from dynamic functions
- Added type guard optimization to prevent double normalization of static arrays
- Comprehensive test coverage for edge cases (async functions, nested dynamics, error handling)

## Migration Guide

No breaking changes. All existing model configurations continue to work:
- Static single models: `model: 'openai/gpt-4'`
- Static arrays: `model: [{ model: 'openai/gpt-4', maxRetries: 2 }]`
- Dynamic single: `model: ({ requestContext }) => 'openai/gpt-4'`
- Dynamic arrays (NEW): `model: ({ requestContext }) => [{ model: 'openai/gpt-4', maxRetries: 2 }]`

Closes #11951
