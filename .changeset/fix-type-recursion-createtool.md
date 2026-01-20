---
'@mastra/core': patch
---

**Fix TypeScript Type Recursion in createTool (#11964)**

Fixed a critical TypeScript type recursion issue (TS2589) that occurred when using `createTool` with inline Zod schemas in CommonJS projects.

**Impact:**
- CommonJS builds now compile without TS2589 errors
- Full type safety restored for tool creation  
- No breaking changes - drop-in fix
- Better TypeScript compiler performance

**Before:**
```typescript
// Failed with TS2589
export const myTool = createTool({
  id: 'my-tool',
  inputSchema: z.object({ name: z.string() }),
  execute: async (input) => ({ result: input.name }),
});
```

**After:**
```typescript
// Works perfectly! ✅
export const myTool = createTool({
  id: 'my-tool', 
  inputSchema: z.object({ name: z.string() }),
  execute: async (input, context) => {
    const mastra = context?.mastra; // Full type inference
    return { result: input.name };
  },
});
```
