---
'@mastra/observability': minor
---

Increased default serialization limits for AI tracing. The maxStringLength is now 128KB (previously 1KB) and maxDepth is 8 (previously 6). These changes prevent truncation of large LLM prompts and responses during tracing.

To restore the previous behavior, set `serializationOptions` in your observability config:

```ts
serializationOptions: {
  maxStringLength: 1024,
  maxDepth: 6,
}
```
