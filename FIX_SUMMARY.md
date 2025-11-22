# Fix for Issue #10407: inputData undefined in .map() inside .branch()

## Problem

When a workflow with a `.map()` is used inside a `.branch()`, the `inputData` becomes `undefined` (or an empty object `{}`) in the mapped workflow.

### Root Cause

The issue was in the `Run._validateInput()` method in `packages/core/src/workflows/workflow.ts`. This method was validating the workflow's input data against the **first step's input schema** instead of the **workflow's own input schema**.

When a workflow starts with a `.map()` step:

1. The mapping step is created with an `inputSchema: z.object({})` (empty object schema)
2. When the workflow's input data (e.g., `{value: 15}`) is validated against this empty schema
3. Zod's `safeParse` returns `{success: true, data: {}}` - stripping all properties
4. The workflow then uses this empty object as its input, causing `inputData` to be `{}` in the map function

### Example of the Bug

```typescript
const workflowA = createWorkflow({
  id: 'workflow-a',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .map(async ({ inputData }) => {
    // BUG: inputData is {} instead of { value: 15 }
    console.log(inputData); // {}
    return { numberValue: inputData.value }; // undefined!
  })
  .then(step1)
  .commit();

const mainWorkflow = createWorkflow({
  id: 'main',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
})
  .branch([[async ({ inputData }) => inputData.value > 10, workflowA]])
  .commit();

await mainWorkflow.execute({ inputData: { value: 15 } });
// workflowA receives { value: 15 } but internally transforms it to {}
```

## Solution

Changed the `Run._validateInput()` method to validate against the **workflow's own `inputSchema`** instead of the first step's input schema.

### Changes Made

1. **Modified `Run._validateInput()` method** (`packages/core/src/workflows/workflow.ts`, lines 1579-1593):
   - Removed logic that extracted the first step's input schema
   - Now validates directly against `this.inputSchema` (the workflow's input schema)
   - Simplified the validation logic significantly

2. **Added `inputSchema` to `Run` class** (`packages/core/src/workflows/workflow.ts`):
   - Added `inputSchema` property to the `Run` class (line 1515)
   - Added `inputSchema` parameter to the `Run` constructor (line 1527)
   - Assigned `inputSchema` in the constructor (line 1559)
   - Passed `this.inputSchema` when creating a `Run` in `Workflow.createRun()` (line 1012)

3. **Created test case** (`packages/core/src/workflows/branch-map-bug.test.ts`):
   - Reproduces the exact scenario from issue #10407
   - Verifies that `inputData` is correctly passed to the nested workflow with `.map()`
   - Ensures the workflow executes successfully with the correct data

### Code Changes

#### Before (Buggy Code)

```typescript
protected async _validateInput(inputData: z.input<TInput>) {
  const firstEntry = this.executionGraph.steps[0];
  let inputDataToUse = inputData;

  if (firstEntry && this.validateInputs) {
    let inputSchema: z.ZodType<any> | undefined;

    if (firstEntry.type === 'step' || firstEntry.type === 'foreach' || firstEntry.type === 'loop') {
      const step = firstEntry.step;
      inputSchema = step.inputSchema; // ❌ Using first step's schema
    } else if (firstEntry.type === 'conditional' || firstEntry.type === 'parallel') {
      const firstStep = firstEntry.steps[0];
      if (firstStep && firstStep.type === 'step') {
        inputSchema = firstStep.step.inputSchema; // ❌ Using first step's schema
      }
    }

    if (inputSchema) {
      const validatedInputData = await inputSchema.safeParseAsync(inputData);
      // ... validation logic
      inputDataToUse = validatedInputData.data; // ❌ Empty object when first step has z.object({})
    }
  }

  return inputDataToUse;
}
```

#### After (Fixed Code)

```typescript
protected async _validateInput(inputData: z.input<TInput>) {
  let inputDataToUse = inputData;

  if (this.validateInputs && this.inputSchema) { // ✅ Using workflow's own schema
    const validatedInputData = await this.inputSchema.safeParseAsync(inputData);

    if (!validatedInputData.success) {
      const errors = getZodErrors(validatedInputData.error);
      throw new Error(
        'Invalid input data: \n' + errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
      );
    }

    inputDataToUse = validatedInputData.data; // ✅ Preserves all properties from workflow's schema
  }

  return inputDataToUse;
}
```

## Testing

### Test Results

1. **New test passes**: `branch-map-bug.test.ts` successfully validates the fix
2. **All existing tests pass**: 275 tests passed, 5 skipped (280 total)
3. **No regressions**: All workflow-related tests continue to pass

### Test Output

```
✓ src/workflows/branch-map-bug.test.ts (1 test) 4ms
✓ src/workflows/workflow.test.ts (166 tests) 24641ms

Test Files  7 passed (7)
Tests  275 passed | 5 skipped (280)
```

## Impact

This fix ensures that:

1. Workflows correctly receive their input data when used as steps in other workflows
2. The `.map()` function receives the correct `inputData` regardless of where the workflow is used
3. Input validation is performed against the workflow's declared input schema, not the first step's schema
4. The fix is backward compatible - all existing tests pass

## Files Modified

1. `packages/core/src/workflows/workflow.ts` - Fixed `_validateInput()` method and added `inputSchema` to `Run` class
2. `packages/core/src/workflows/branch-map-bug.test.ts` - Added test case to prevent regression

## Related Issue

Fixes #10407
