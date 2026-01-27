# Phase 3 Research: Schema Validation & Defaults

**Date:** 2026-01-27
**Researcher:** Claude
**Phase:** 03-schema-validation
**Question:** What do I need to know to PLAN this phase well?

---

## Executive Summary

Phase 3 requires porting 12 schema validation tests from the default runtime to the evented runtime. The **good news**: Most validation infrastructure already exists and is shared between both runtimes. The **challenge**: Understanding how defaults are applied through Zod's `safeParseAsync()` and ensuring the evented runtime correctly uses `validatedData.data` (which contains defaults) instead of raw input.

**Key Finding:** The evented runtime inherits validation methods from the base `Workflow` class, so the core validation logic is already in place. However, we need to verify that:
1. Defaults from schemas are properly applied in all validation paths (workflow input, step input, resume data)
2. ZodError is preserved as the `cause` when validation fails
3. Validation works correctly in complex scenarios (.map(), .foreach(), nested workflows)

---

## Current Implementation Analysis

### Shared Validation Infrastructure

Both default and evented runtimes share the same validation foundation through the base `Workflow` class:

**Location:** `/packages/core/src/workflows/workflow.ts`

#### Three Validation Methods:

1. **`_validateInput(inputData)`** (lines 2541-2556)
   - Validates workflow-level input against `inputSchema`
   - **Key**: Returns `validatedInputData.data` which includes defaults
   ```typescript
   const validatedInputData = await this.inputSchema.safeParseAsync(inputData);
   // ...
   inputDataToUse = validatedInputData.data; // Contains defaults!
   ```

2. **`_validateInitialState(initialState)`** (lines 2558-2578)
   - Validates state against `stateSchema`
   - Same pattern: returns `validatedInitialState.data`

3. **`_validateResumeData(resumeData, suspendedStep)`** (lines 2580-2597)
   - Validates resume data against step's `resumeSchema`
   - Same pattern: returns `validatedResumeData.data`

#### Step-Level Validation

**Location:** `/packages/core/src/workflows/utils.ts`

The `validateStepInput()` function (lines 22-60) validates step inputs:

```typescript
export async function validateStepInput({
  prevOutput,
  step,
  validateInputs,
}: {
  prevOutput: any;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  let inputData = prevOutput;
  let validationError: Error | undefined;

  if (validateInputs && isZodType(step.inputSchema)) {
    const validatedInput = await inputSchema.safeParseAsync(prevOutput);

    if (!validatedInput.success) {
      // Creates MastraError with ZodError as cause
      validationError = new MastraError(
        {
          id: 'WORKFLOW_STEP_INPUT_VALIDATION_FAILED',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.USER,
          text: 'Step input validation failed: \n' + errorMessages,
        },
        validatedInput.error, // ZodError preserved as cause!
      );
    } else {
      const isEmptyData = isEmpty(validatedInput.data);
      inputData = isEmptyData ? prevOutput : validatedInput.data; // Defaults applied
    }
  }

  return { inputData, validationError };
}
```

**Note:** There's a subtle edge case on line 55: if `validatedInput.data` is empty (isEmpty), it falls back to `prevOutput`. This might prevent defaults from being applied in some cases.

Similar functions exist for:
- `validateStepResumeData()` (lines 62-91) - resume data validation
- `validateStepSuspendData()` (lines 93-130) - suspend data validation (optional)
- `validateStepStateData()` (lines 132-160) - state validation

### EventedWorkflow Integration

**Location:** `/packages/core/src/workflows/evented/workflow.ts`

The `EventedWorkflow` class extends `Workflow` (line 1037):
```typescript
export class EventedWorkflow<...> extends Workflow<...> {
```

This means it inherits all `_validateInput()`, `_validateInitialState()`, and `_validateResumeData()` methods.

**Usage in evented runtime:**

1. **Workflow input validation** (lines 1214, 1297):
   ```typescript
   const inputDataToUse = await this._validateInput(inputData ?? ({} as TInput));
   const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));
   ```

2. **Resume data validation** (line 1391):
   ```typescript
   const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);
   ```

3. **Step input validation** - Done in `StepExecutor.execute()`:
   **Location:** `/packages/core/src/workflows/evented/step-executor.ts` (line 54)
   ```typescript
   const { inputData, validationError } = await validateStepInput({
     prevOutput: typeof params.foreachIdx === 'number' ? params.input?.[params.foreachIdx] : params.input,
     step,
     validateInputs: params.validateInputs ?? true,
   });
   ```

**validateInputs flag:** Defaults to `true` in evented runtime (line 1016):
```typescript
validateInputs: params.options?.validateInputs ?? true,
```

---

## Test Requirements Analysis

### 12 Tests to Port

Based on `/packages/core/src/workflows/workflow.test.ts`, here are the tests we need to port:

#### 1. Default Values (3 tests)

**Test: "should use default value from inputSchema"** (lines 8753-8801)
- Workflow input has optional field with `.default({ value: 1 })`
- Pass incomplete input (missing optional field)
- Verify step receives input with default value applied

**Test: "should use default value from inputSchema for step input"** (lines 8940-9020)
- Step2 has `.optional().default('test')` on its input
- Step1 returns empty object for that field
- Use `.map()` to pass data to step2
- Verify step2 receives default value 'test'

**Test: "should use default value from resumeSchema when resuming"** (lines 9288-9367)
- Step has `resumeSchema: z.object({ value: z.number().optional().default(21) })`
- Resume with empty object `{}`
- Verify resumePayload includes default value 21

#### 2. Validation Errors (6 tests)

**Test: "should throw error if trigger data is invalid"** (lines 8640 and 9753)
- Pass invalid input that doesn't match workflow inputSchema
- Verify workflow fails with validation error
- Appears twice in test file (default and zod v4 sections)

**Test: "should throw error if inputData is invalid"** (lines 8803-8887, 9925-10018)
- Step2 expects `{ start: string }` but receives `{ result: string }` from step1
- Verify step2 fails with "Step input validation failed"
- Error message includes "start: Required"

**Test: "should throw error if inputData is invalid in workflow with .map()"** (lines 9022-9116)
- Similar to above but uses `.map()` to transform data between steps
- Step2 expects string, gets number after .map()
- Verify validation error with type mismatch message

**Test: "should throw error if inputData is invalid in nested workflows"** (lines 9369-9486)
- Parent workflow contains nested workflow as a step
- Nested workflow step has validation that fails
- Verify error propagates to parent workflow

**Test: "should throw error when you try to resume a workflow step with invalid resume data"** (lines 9206-9286)
- Step has `resumeSchema: z.object({ value: z.number() })`
- Try to resume with `{ number: 2 }` (wrong field name)
- Verify error: "Invalid resume data: \n- value: Required"
- Workflow should remain suspended after failed resume attempt

#### 3. Error Preservation (1 test)

**Test: "should preserve ZodError as cause when input validation fails"** (lines 8889-8938)
- Step expects `{ requiredField: string, numberField: number }`
- Pass empty object `{}`
- Verify:
  - `result.error.message` contains "Step input validation failed"
  - `result.error.cause` is defined
  - `result.error.cause.issues` is array (ZodError structure)
  - `result.error.cause.issues.length >= 2` (both fields missing)

#### 4. Complex Scenarios (2 tests)

**Test: "should properly validate input schema when .map is used after .foreach"** (lines 9118-9204)
- `.foreach()` executes step for each item in array
- `.map()` transforms the array result
- Final step receives mapped value
- Verify validation works correctly through this chain
- This is a regression test for bug #11313

**Test: "should allow a steps input schema to be a subset of the previous step output schema"** (lines 9488-9625)
- Step1 outputs `{ a: string, b: string.optional() }`
- Step2 expects only `{ b?: string }` (subset, omitting 'a')
- Verify this is allowed and works correctly
- Tests that input validation doesn't require exact schema match

---

## Key Technical Details

### How Zod Defaults Work

When you call `schema.safeParseAsync(data)`:

1. **If validation succeeds:**
   - `validatedInput.success === true`
   - `validatedInput.data` contains the parsed data **with defaults applied**
   - Example:
     ```typescript
     const schema = z.object({
       required: z.string(),
       optional: z.number().optional().default(42)
     });
     const result = await schema.safeParseAsync({ required: 'test' });
     // result.data === { required: 'test', optional: 42 }
     ```

2. **If validation fails:**
   - `validatedInput.success === false`
   - `validatedInput.error` is a `ZodError` instance
   - `validatedInput.error.issues` is an array of validation issues

### MastraError and Cause Chain

From `/packages/core/src/workflows/utils.ts` (lines 43-52):

```typescript
validationError = new MastraError(
  {
    id: 'WORKFLOW_STEP_INPUT_VALIDATION_FAILED',
    domain: ErrorDomain.MASTRA_WORKFLOW,
    category: ErrorCategory.USER,
    text: 'Step input validation failed: \n' + errorMessages,
  },
  // Second parameter becomes the 'cause'
  validatedInput.error, // This is the ZodError
);
```

The `MastraError` constructor accepts a second parameter that becomes the error's `cause`. This preserves the original ZodError for consumers who need detailed validation information.

### Validation in Different Contexts

1. **Workflow Input:**
   - Validated in `_validateInput()` (base Workflow class)
   - Called in EventedRun.start() before execution begins
   - Throws error if invalid (workflow never starts)

2. **Step Input:**
   - Validated in `validateStepInput()` utility
   - Called in StepExecutor.execute() before step runs
   - If validation fails, step is marked as failed with error

3. **Resume Data:**
   - Validated in `_validateResumeData()` (base Workflow class)
   - Called in EventedRun.resume() before resuming
   - Throws error if invalid (workflow remains suspended)

4. **Nested Workflows:**
   - Child workflow is treated as a regular step
   - Child's input is validated against its inputSchema
   - Errors propagate to parent workflow

### Edge Cases to Watch

1. **isEmpty() check in validateStepInput():**
   - Line 54-55 in utils.ts:
     ```typescript
     const isEmptyData = isEmpty(validatedInput.data);
     inputData = isEmptyData ? prevOutput : validatedInput.data;
     ```
   - If validated data is empty (e.g., `{}`), it uses original input instead
   - This might prevent defaults from being applied in some cases
   - Need to verify this doesn't break default value tests

2. **.map() and .foreach() validation:**
   - When using `.map()`, the mapped data becomes the next step's input
   - Validation happens on the mapped data, not the original
   - Need to ensure validation occurs at the right point in the chain

3. **Nested workflow input:**
   - Nested workflow receives its input from parent step's output
   - Must validate against nested workflow's inputSchema
   - Currently handled by treating nested workflow as a component

---

## Implementation Status

### What Already Works

✅ **Workflow-level validation** - inherited from base Workflow class
✅ **Step-level validation** - implemented in StepExecutor
✅ **Resume data validation** - inherited from base Workflow class
✅ **ZodError preservation** - MastraError properly chains cause
✅ **validateInputs flag** - properly threaded through evented runtime

### What Might Need Work

⚠️ **isEmpty() edge case** - May prevent defaults in some scenarios
⚠️ **Complex validation chains** - .map() after .foreach() needs verification
⚠️ **Nested workflow validation** - Need to verify error propagation
⚠️ **Trigger data validation** - Not clearly implemented (tests suggest it should fail early)

### Unknowns

❓ **Trigger data validation** - Where/how is the "trigger" validated?
❓ **Subset schema matching** - Is this a TypeScript-only constraint or runtime check?
❓ **Zod v4 compatibility** - Tests have zod v4 section, need to verify compatibility

---

## Test Porting Strategy

### Phase 3 should follow the same pattern as Phases 1 and 2:

1. **RED Phase (Plan 03-01):**
   - Port all 12 tests to evented-workflow.test.ts
   - Tests should fail (or some might pass if validation is already working)
   - Create a "Schema Validation & Defaults" describe block

2. **GREEN Phase (Plan 03-02 if needed):**
   - Fix any failing tests
   - Likely fixes:
     - Remove or adjust isEmpty() check in validateStepInput()
     - Ensure all validation paths use `validatedData.data`
     - Verify nested workflow input validation
   - Most tests might already pass since validation infrastructure exists

### Test Organization

Add to `/packages/core/src/workflows/evented/evented-workflow.test.ts`:

```typescript
describe('Schema Validation & Defaults', () => {
  describe('Default Values', () => {
    it('should use default value from inputSchema', async () => { ... });
    it('should use default value from inputSchema for step input', async () => { ... });
    it('should use default value from resumeSchema when resuming', async () => { ... });
  });

  describe('Validation Errors', () => {
    it('should throw error if trigger data is invalid', async () => { ... });
    it('should throw error if inputData is invalid', async () => { ... });
    it('should throw error if inputData is invalid in workflow with .map()', async () => { ... });
    it('should throw error if inputData is invalid in nested workflows', async () => { ... });
    it('should throw error when you try to resume a workflow step with invalid resume data', async () => { ... });
  });

  describe('Error Details', () => {
    it('should preserve ZodError as cause when input validation fails', async () => { ... });
  });

  describe('Complex Scenarios', () => {
    it('should properly validate input schema when .map is used after .foreach', async () => { ... });
    it('should allow a steps input schema to be a subset of the previous step output schema', async () => { ... });
  });
});
```

---

## Questions to Investigate During Planning

1. **What is "trigger data"?**
   - Is this just workflow input, or something specific to evented runtime?
   - The test name suggests it's different from regular inputData

2. **Does the isEmpty() check cause issues?**
   - Line 54-55 in validateStepInput() might prevent defaults
   - Need to test: what happens when validatedInput.data is `{}` but has defaults?

3. **How does validation work in .map()?**
   - Is the mapped function's output validated?
   - Or is validation skipped until the next step?

4. **Subset schema matching:**
   - Is this purely a TypeScript check?
   - Or does Zod allow parsing with a subset schema?
   - The test implies it should "just work" - verify this

---

## Files to Examine During Planning

### Source Files
- `/packages/core/src/workflows/workflow.ts` - Base validation methods
- `/packages/core/src/workflows/utils.ts` - validateStepInput and friends
- `/packages/core/src/workflows/evented/step-executor.ts` - Step execution with validation
- `/packages/core/src/workflows/evented/workflow.ts` - EventedWorkflow validation calls

### Test Files
- `/packages/core/src/workflows/workflow.test.ts` - Reference tests (lines 8640-9625)
- `/packages/core/src/workflows/evented/evented-workflow.test.ts` - Target for new tests

### Error Handling
- `/packages/core/src/error/` - MastraError implementation
- Look for how cause chain is serialized/deserialized

---

## Risk Assessment

**Low Risk:**
- Most validation infrastructure already exists
- Tests might already pass without changes
- Clear pattern from Phases 1 and 2 to follow

**Medium Risk:**
- isEmpty() edge case might cause unexpected failures
- .map() and .foreach() validation chain might be complex
- Nested workflow error propagation might need debugging

**High Risk:**
- None identified

---

## Success Criteria for Planning

A good plan should answer:

1. ✅ **Which tests to port?** - All 12 tests identified with line numbers
2. ✅ **Where to add them?** - evented-workflow.test.ts, organized by category
3. ✅ **What's the current state?** - Validation infrastructure exists, might mostly work
4. ✅ **What might need fixing?** - isEmpty() check, validation in complex chains
5. ✅ **How to verify?** - Run tests, check for validation errors with defaults applied

---

## Recommendations

1. **Start with RED phase:**
   - Port all 12 tests first
   - See which ones fail
   - Failures will guide GREEN phase work

2. **Investigate isEmpty() first:**
   - This is the most likely source of default value issues
   - Write a minimal test case to verify behavior

3. **Test nested workflows carefully:**
   - Error propagation is complex
   - Verify both validation errors and runtime errors propagate

4. **Consider splitting GREEN phase:**
   - If many tests fail, split fixes into logical groups:
     - Plan 03-02: Fix default values (isEmpty issue)
     - Plan 03-03: Fix complex validation chains (.map, .foreach)
     - Plan 03-04: Fix nested workflow validation

5. **Use existing test patterns:**
   - Follow the same structure as Phases 1 and 2
   - Copy test setup from default runtime, adapt for evented (pubsub, startEventEngine)

---

## Conclusion

Phase 3 appears **more straightforward than Phases 1 and 2** because:
- Validation infrastructure already exists and is shared
- Evented runtime already uses the validation methods
- Most tests might pass without any changes

The main work is:
1. Porting the 12 tests (mechanical work)
2. Investigating any failures (likely isEmpty() edge case)
3. Verifying complex scenarios (.map, .foreach, nested workflows)

**Estimated effort:** 1-2 plans (RED phase + possible GREEN phase if fixes needed)

**Confidence level:** High - validation is well-implemented, just needs test coverage verification.
