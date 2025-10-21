---
'@mastra/core': patch
---

feat(ai-tracing): Add automatic metadata extraction from RuntimeContext to spans

Enables automatic extraction of RuntimeContext values as metadata for AI tracing spans across entire traces.

Key features:
- Configure `runtimeContextKeys` in TracingConfig to extract specific keys from RuntimeContext
- Add per-request keys via `tracingOptions.runtimeContextKeys` for trace-specific additions
- Supports dot notation for nested values (e.g., 'user.id', 'session.data.experimentId')
- TraceState computed once at root span and inherited by all child spans
- Explicit metadata in span options takes precedence over extracted metadata

Example:
```typescript
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        runtimeContextKeys: ['userId', 'environment', 'tenantId']
      }
    }
  }
});

await agent.generate({
  messages,
  runtimeContext,
  tracingOptions: {
    runtimeContextKeys: ['experimentId']  // Adds to configured keys
  }
});
```
