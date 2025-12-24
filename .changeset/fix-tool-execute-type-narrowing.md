---
"@mastra/core": patch
---

Fixed inline type narrowing for `tool.execute()` return type when using `outputSchema`.

**Problem:** When calling `tool.execute()`, TypeScript couldn't narrow the `ValidationError | OutputType` union after checking `'error' in result && result.error`, causing type errors when accessing output properties.

**Solution:**
- Added `{ error?: never }` to the success type, enabling proper discriminated union narrowing
- Simplified `createTool` generics so `inputData` is correctly typed based on `inputSchema`

**Usage:**
```typescript
const result = await myTool.execute({ firstName: 'Hans' });

if ('error' in result && result.error) {
  console.error('Validation failed:', result.message);
  return;
}

// ✅ TypeScript now correctly narrows result
return { fullName: result.fullName };
```

