---
'@mastra/core': minor
---

Adds a new `suspendData` parameter to workflow step execute functions that provides access to the data originally passed to `suspend()` when the step was suspended. This enables steps to access context about why they were suspended when they are later resumed.

**New Features:**
- `suspendData` parameter automatically populated in step execute function when resuming
- Type-safe access to suspend data matching the step's `suspendSchema`
- Backward compatible - existing workflows continue to work unchanged

**Example:**
```typescript
const step = createStep({
  suspendSchema: z.object({ reason: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ suspend, suspendData, resumeData }) => {
    if (!resumeData?.approved) {
      return await suspend({ reason: "Approval required" });
    }
    
    // Access original suspend data when resuming
    console.log(`Resuming after: ${suspendData?.reason}`);
    return { result: "Approved" };
  }
});
```