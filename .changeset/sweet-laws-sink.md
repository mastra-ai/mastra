---
'@mastra/core': major
---

Changed `.branch()` result schema to make all branch output fields optional.

**Breaking change**: Branch outputs are now optional since only one branch executes at runtime. Update your workflow schemas to handle optional branch results.

**Before:**
```typescript
const workflow = createWorkflow({...})
  .branch([
    [condition1, stepA],  // outputSchema: { result: z.string() }
    [condition2, stepB],  // outputSchema: { data: z.number() }
  ])
  .map({
    finalResult: { step: stepA, path: 'result' }  // Expected non-optional
  });
```

**After:**
```typescript
const workflow = createWorkflow({...})
  .branch([
    [condition1, stepA],
    [condition2, stepB],
  ])
  .map({
    finalResult: {
      step: stepA,
      path: 'result'  // Now optional - provide fallback
    }
  });
```

**Why**: Branch conditionals execute only one path, so non-executed branches don't produce outputs. The type system now correctly reflects this runtime behavior.

Related issue: https://github.com/mastra-ai/mastra/issues/10642
