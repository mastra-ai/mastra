---
'@mastra/core': patch
---

Fix ToolStream type error when piping streams with different types

Changes `ToolStream` to extend `WritableStream<unknown>` instead of `WritableStream<T>`. This fixes the TypeScript error when piping `objectStream` or `fullStream` to `writer` in workflow steps.

Before:
```typescript
// TypeError: ToolStream<ChunkType> is not assignable to WritableStream<Partial<StoryPlan>>
await response.objectStream.pipeTo(writer);
```

After:
```typescript
// Works without type errors
await response.objectStream.pipeTo(writer);
```

