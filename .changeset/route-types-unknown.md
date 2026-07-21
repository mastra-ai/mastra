---
'@mastra/client-js': patch
'@mastra/server': patch
---

Replace `any` with `unknown` in generated route types so clients get real type errors instead of silently unchecked values. Route-types generation now deduplicates shared schemas into reusable type aliases, shrinking the generated `route-types.generated.ts` from ~94K to ~22K lines (77% smaller). The memory config response now types `workingMemory` (enabled, scope, template, schema, version) instead of `unknown`.

If your code read fields from responses that were previously typed `any`, TypeScript now requires you to narrow them before use:

```ts
// Before: `metadata` was `any`, so this compiled even when unsafe
const value = response.metadata.someField;

// After: `metadata` is `unknown` — narrow it first
const metadata = response.metadata;
if (metadata && typeof metadata === 'object' && 'someField' in metadata) {
  const value = metadata.someField;
}
// ...or cast if you know the shape: (metadata as MyMetadata).someField
```

Code that reads `workingMemory` from the memory config response no longer needs casts — `config.workingMemory?.enabled`, `scope`, `template`, `schema`, and `version` are now typed directly.
