# isVercelTool v5 Tool Detection Issue

## Executive Summary

**Status:** 🚨 **CRITICAL BUG CONFIRMED** - 36 tests created, 12 failures proving 3 distinct bugs

The `isVercelTool()` type guard only checks for v4 tools (with `parameters` property) and does not detect v5 tools (with `inputSchema` property). This causes v5 tools to be misidentified as Mastra tools and executed with the wrong function signature.

**Confirmed Bugs:**

1. **Type Guard Bug** - `isVercelTool()` returns false for v5 tools (4 test failures)
2. **Property Setting Bug** - v5 tools don't get required `id` property set (4 test failures)
3. **Execute Signature Bug** 🚨 **CRITICAL** - v5 tools called with wrong parameters causing runtime failure (3 test failures)

**Impact:** Any v5 tool (including provider-defined tools like `google.tools.googleSearch`) will fail at runtime when executed through agents or tool builders.

**Exception:** Client-side tool processing works by accident (else branch handles both cases).

---

## Problem Statement

The `isVercelTool()` type guard only checks for v4 tools (with `parameters` property) and does not detect v5 tools (with `inputSchema` property). This causes v5 tools to be misidentified as Mastra tools and executed with the wrong function signature.

## Discovery Context

This issue was discovered during PR review for issue #8455 (provider-defined tools). Greptile left a comment about `isVercelTool` not handling v5 tools with `inputSchema`.

### Related Slack Conversation

Tyler Barnes mentioned:

> "v5 tools have the same signature as ours iirc. On the original v5 branch I had added an internal \_\_isMastraTool: true on our tools to tell the difference but I don't think it was needed for some reason in the streamvnext work"

**Key Question**: Do v5 tools have the same execute signature as Mastra tools, or do they use the AI SDK signature?

## Current Implementation

### isVercelTool (packages/core/src/tools/toolchecks.ts)

```typescript
export function isVercelTool(tool?: ToolToConvert): tool is VercelTool {
  return !!(tool && !(tool instanceof Tool) && 'parameters' in tool);
}
```

**Problem**: Only checks for `parameters` property (v4), not `inputSchema` (v5).

## Impact Analysis

### Critical Usage 1: packages/core/src/tools/tool-builder/builder.ts:181

```typescript
if (isVercelTool(tool)) {
  // Handle Vercel tools (AI SDK tools)
  result = await tool?.execute?.(args, execOptions as ToolExecutionOptions);
} else {
  // Handle Mastra tools
  result = await tool?.execute?.({
    context: args,
    threadId: options.threadId,
    mastra: wrappedMastra,
    memory: options.memory,
    agent,
    runId: options.runId,
    messages: options.messages,
    agentContext: options.agentContext,
    anthropic: options.anthropic,
  });
}
```

**Impact**: If a v5 tool fails the `isVercelTool()` check, it falls into the else branch and gets called with Mastra's execute signature instead of AI SDK's signature.

**Execute Signatures**:

- **AI SDK (Vercel) signature**: `execute(args, options)`
- **Mastra signature**: `execute({ context, mastra, threadId, memory, agent, ... })`

### Usage 2: packages/core/src/utils.ts:293

```typescript
if (isVercelTool(tool)) {
  setVercelToolProperties(toolObj, tool);
}
```

**Impact**: V5 tools would skip property setting, but `setVercelToolProperties` already handles both v4 and v5 internally:

```typescript
const inputSchema = 'inputSchema' in tool ? tool.inputSchema : convertVercelToolParameters(tool);
```

### Other Usages

- `packages/core/src/tools/tool-builder/builder.ts:56` - Type check only
- `packages/server/src/server/handlers/tools.ts` - TBD
- `client-sdks/client-js/src/utils/process-client-tools.ts` - TBD

## Key Questions ANSWERED

1. **Do v5 tools use the same execute signature as Mastra tools or AI SDK tools?**
   - ✅ **CONFIRMED**: V5 tools use AI SDK signature, NOT Mastra signature
   - **AI SDK (v4 and v5)**: `execute(input, options)`
     - From `@ai-sdk/provider-utils@3.0.10` line 623:
     ```typescript
     type ToolExecuteFunction<INPUT, OUTPUT> = (input: INPUT, options: ToolCallOptions) => ...
     ```
   - **Mastra Tool**: `execute(context, options)` where context includes `{ context, mastra, threadId, memory, agent, ... }`
     - From [packages/core/src/tools/types.ts:83-86](packages/core/src/tools/types.ts#L83-L86)
   - **This confirms the bug is REAL**: V5 tools failing `isVercelTool()` would be called with wrong signature and would fail at runtime

2. **Is the \_\_isMastraTool flag still needed?**
   - Tyler mentioned adding this on the original v5 branch but it wasn't needed in streamvnext
   - Tyler's comment was **incorrect** about v5 having same signature as Mastra - they are different
   - ⏳ Need to check git history for context on why it wasn't needed

3. **What is the actual behavior when a v5 tool is executed?**
   - **Expected**: Tool execution would fail because of signature mismatch
   - **V5 tool expects**: `execute(args, options)` where args is the parsed input
   - **Would receive**: `execute({ context: args, mastra, threadId, memory, agent, ... }, options)`
   - The first parameter would be a large Mastra context object instead of just the args
   - The tool's execute function would try to access properties that don't exist
   - ⏳ Need integration test to confirm actual error message

## Investigation Steps

1. ✅ Find all occurrences of `isVercelTool`
2. ✅ Analyze how it's used in each location
3. ✅ Check AI SDK v5 tool type definitions for execute signature - **CONFIRMED BUG EXISTS**
4. ✅ Create comprehensive tests demonstrating bugs in all scenarios
5. ⏳ Implement fix for `isVercelTool` to detect both v4 and v5 tools
6. ⏳ Verify all tests pass after fix

## Test Coverage

### Unit Tests: [packages/core/src/tools/toolchecks.test.ts](packages/core/src/tools/toolchecks.test.ts)

Basic type guard tests:

- ✅ v4 tool detection (with parameters) - PASSES
- ❌ v5 tool detection (with inputSchema) - **FAILS** (demonstrates bug)
- ✅ Mastra tool exclusion - PASSES
- ✅ Edge cases (undefined, plain objects) - PASSES

### Integration Tests: [packages/core/src/tools/isVercelTool-integration.test.ts](packages/core/src/tools/isVercelTool-integration.test.ts)

Comprehensive tests covering all `isVercelTool` usage scenarios:

**Test Results: 10 failed / 16 total**

**Type Guard Tests:**

- ✅ v4 tools detected correctly
- ❌ v5 tools NOT detected - **BUG CONFIRMED**
- ✅ Mastra tools excluded correctly

**Scenario-Based Bug Demonstrations:**

1. **builder.ts:52 getParameters()** - Has manual workaround
   - Tests skipped due to ToolBuilder import issues

2. **builder.ts:177 execute()** - **CRITICAL BUG**
   - Tests skipped due to ToolBuilder import issues
   - Would demonstrate v5 tools getting wrong execute signature

3. **utils.ts:293 ensureToolProperties()**
   - ❌ v4 tools: Expected `type: 'function'` but got `undefined`
   - ❌ v5 tools: Same issue
   - ✅ Mastra tools pass through correctly

4. **Real-world provider tools**
   - ❌ Google v5 tool not recognized - **FAILS**

**Edge Cases:**

- ✅ Hybrid tools (both parameters and inputSchema) work
- ❌ Tools with function schemas NOT recognized
- ✅ Undefined/plain objects handled correctly

## Comprehensive Testing Plan

For each `isVercelTool` usage, we need to identify and test the specific bugs that v5 tools would experience:

### 1. **builder.ts:52** - `getParameters()`

**Current Code:**

```typescript
if (isVercelTool(this.originalTool)) {
  let schema = this.originalTool.parameters ??
    ('inputSchema' in this.originalTool ? (this.originalTool as any).inputSchema : undefined) ??
    z.object({});
```

**Bug:** v5 tools fail `isVercelTool()`, fall to else branch, try to access `inputSchema` on Mastra tool
**Has Workaround:** Yes - manual `'inputSchema' in tool` check
**Test Needed:** Verify v5 tool parameters are extracted correctly

### 2. **builder.ts:177** - `execute()` - **CRITICAL**

**Current Code:**

```typescript
if (isVercelTool(tool)) {
  result = await tool?.execute?.(args, execOptions);
} else {
  result = await tool?.execute?.({ context: args, mastra, threadId, ... });
}
```

**Bug:** v5 tools get called with wrong signature → **RUNTIME FAILURE**

- Expected: `execute(args, options)`
- Actual: `execute({ context, mastra, threadId, ... }, options)`
  **Test Needed:**
- Simple mock test showing v5 tool receives wrong parameters
- Integration test with CoreToolBuilder showing actual execution failure

### 3. **utils.ts:293** - `ensureToolProperties()`

**Current Code:**

```typescript
if (isVercelTool(tool)) {
  acc[key] = setVercelToolProperties(tool) as VercelTool;
} else {
  acc[key] = tool;
}
```

**Bug:** v5 tools skip `setVercelToolProperties()`, missing required properties like `type: 'function'`
**Impact:** Tools sent to AI SDK without proper formatting
**Test Needed:** Verify v5 tools get properties set correctly

### 4. **server/handlers/tools.ts:92** - Server execute

**Current Code:**

```typescript
if (isVercelTool(tool)) {
  const result = await (tool as any).execute(data);
  return result;
}
const result = await tool.execute({ context: data, ... });
```

**Bug:** v5 tools in server endpoints get wrong execute signature
**Test Needed:** Server handler test with v5 tool

### 5. **client-js/process-client-tools.ts:12** - Parameter conversion

**Current Code:**

```typescript
if (isVercelTool(value)) {
  return [key, {
    ...value,
    parameters: value.parameters ? zodToJsonSchema(value.parameters) : undefined,
```

**Bug:** v5 tools skip parameter conversion, `inputSchema` not converted to JSON schema
**Impact:** Client receives Zod schema instead of JSON schema
**Test Needed:** Verify v5 tool inputSchema gets converted

## Detailed Test Plan

### Test File 1: `packages/core/src/tools/toolchecks.test.ts` (EXISTS)

**Purpose:** Basic type guard tests

**Tests to add:**

1. ✅ Should detect v4 tools with `parameters` - EXISTING
2. ❌ Should detect v5 tools with `inputSchema` - SHOULD FAIL
3. ✅ Should exclude Mastra Tool instances - EXISTING
4. ❌ Should detect v5 tools with function schemas - SHOULD FAIL
5. ✅ Should handle edge cases (undefined, plain objects) - EXISTING

**Expected Results:** Tests 2 and 4 should FAIL before fix, PASS after fix

---

### Test File 2: `packages/core/src/utils.test.ts` (EXISTS)

**Purpose:** Test `ensureToolProperties()` for v5 tools

**Tests to add:**

1. **Test: v4 tools get properties set correctly**
   - Create v4 tool with `parameters`
   - Call `ensureToolProperties()`
   - Verify result has `type: 'function'` and proper structure
   - Expected: PASS (v4 tools already work)

2. **Test: v5 tools get properties set correctly - BUG**
   - Create v5 tool with `inputSchema`
   - Call `ensureToolProperties()`
   - Verify result has `type: 'function'` and proper structure
   - Expected: FAIL before fix (v5 tools skip property setting)

3. **Test: Mastra tools pass through unchanged**
   - Create Mastra Tool instance
   - Call `ensureToolProperties()`
   - Verify tool is unchanged
   - Expected: PASS

**Bug Being Tested:** v5 tools skip `setVercelToolProperties()`, missing required properties

---

### Test File 3: `packages/core/src/tools/tool-builder/builder.test.ts` (EXISTS)

**Purpose:** Test execute signature for all tool types

**Tests to add:**

1. **Test: v4 tools execute with correct signature**
   - Create v4 tool with mock execute that captures parameters
   - Execute via CoreToolBuilder
   - Verify execute received `(args, options)` signature
   - Expected: PASS

2. **Test: v5 tools execute with correct signature - CRITICAL BUG**
   - Create v5 tool with mock execute that captures parameters
   - Execute via CoreToolBuilder
   - Verify execute received `(args, options)` signature
   - Expected: FAIL before fix (receives `({ context, mastra, ... }, options)` instead)

3. **Test: Mastra tools execute with context signature**
   - Create Mastra Tool with mock execute that captures parameters
   - Execute via CoreToolBuilder
   - Verify execute received `({ context, mastra, threadId, ... }, options)` signature
   - Expected: PASS

4. **Test: getParameters() extracts schema from v4 tools**
   - Create v4 tool with `parameters: z.object({ input: z.string() })`
   - Access `getParameters()` method
   - Verify returns correct Zod schema
   - Expected: PASS

5. **Test: getParameters() extracts schema from v5 tools**
   - Create v5 tool with `inputSchema: z.object({ input: z.string() })`
   - Access `getParameters()` method
   - Verify returns correct Zod schema (has workaround, so might pass)
   - Expected: PASS (has manual workaround)

**Bugs Being Tested:**

- Execute signature mismatch (CRITICAL)
- Schema extraction (has workaround)

---

### Test File 4: `packages/server/src/server/handlers/tools.test.ts` (CHECK IF EXISTS, CREATE IF NOT)

**Purpose:** Test server handler execute signature

**Tests to add:**

1. **Test: v4 tools execute correctly in server handler**
   - Mock v4 tool with execute
   - Call handler endpoint
   - Verify correct signature used
   - Expected: PASS

2. **Test: v5 tools execute correctly in server handler - BUG**
   - Mock v5 tool with execute
   - Call handler endpoint
   - Verify correct signature used
   - Expected: FAIL before fix

**Bug Being Tested:** Server handlers call v5 tools with wrong signature

---

### Test File 5: `client-sdks/client-js/src/utils/process-client-tools.test.ts` (CHECK IF EXISTS, CREATE IF NOT)

**Purpose:** Test client tool parameter conversion

**Tests to add:**

1. **Test: v4 tools get parameters converted to JSON schema**
   - Create v4 tool with Zod `parameters`
   - Call `processClientTools()`
   - Verify `parameters` is JSON schema, not Zod
   - Expected: PASS

2. **Test: v5 tools get inputSchema converted to JSON schema - BUG**
   - Create v5 tool with Zod `inputSchema`
   - Call `processClientTools()`
   - Verify `inputSchema` is JSON schema, not Zod
   - Expected: FAIL before fix (v5 tools skip conversion)

**Bug Being Tested:** v5 tools don't get schema converted for client

---

## Test Execution Results Summary

### Phase 1: Tests Created ✅

1. ✅ **toolchecks.test.ts** - 14 tests (4 failures expected)
2. ✅ **utils.test.ts** - Added 4 tests for `ensureToolProperties` (2 failures expected)
3. ✅ **builder.test.ts** - Added 4 execute signature tests (3 failures expected)
4. ✅ **client-js/process-client-tools.test.ts** - 6 tests (all pass - no bug!)
5. ✅ **server/tools.test.ts** - Added 3 execute tests (needs fixing, validation issues)

### Phase 2: Test Results WITHOUT Fix

#### ✅ File 1: `toolchecks.test.ts` - **4 FAILURES**

**Bug confirmed: v5 detection fails**

```
✓ v4 tools detected (2 pass)
✗ v5 tools NOT detected (4 fail):
  - v5 tool with inputSchema
  - v5 tool with description
  - v5 tool with function schema
  - Provider-defined v5 tool (google.tools.googleSearch)
✓ Mastra tools excluded (2 pass)
✓ Hybrid tools work (1 pass)
✓ Edge cases (5 pass)
```

#### ✅ File 2: `utils.test.ts` - **2 FAILURES**

**Bug confirmed: v5 tools don't get properties set**

```
✓ v4 tools get id + inputSchema set (1 pass)
✗ v5 tools missing id generation (2 fail):
  - v5 tool with inputSchema - no id set
  - Provider v5 tool - no id set
✓ Mastra tools pass through (1 pass)
```

**Impact:** V5 tools sent to AI SDK without required `id` property

#### ✅ File 3: `builder.test.ts` - **3 FAILURES** 🚨 CRITICAL

**Bug confirmed: v5 tools get WRONG execute signature**

```
✓ v4 tools receive (args, options) signature (1 pass - minor issue)
✗ v5 tools receive WRONG signature (2 fail):
  - Expected: execute({ query: 'test-query' }, options)
  - Actual: execute({ context: { query: 'test-query' }, mastra, threadId, ... }, options)
✗ Provider v5 tools also broken (1 fail)
✓ Mastra tools receive correct signature (1 pass)
```

**Impact:** **RUNTIME FAILURE** - V5 tools cannot execute properly

#### ✅ File 4: `client-js/process-client-tools.test.ts` - **ALL PASS** ✓

**NO BUG - else branch handles v5 correctly**

```
✓ All 6 tests pass
```

**Reason:** The else branch also converts `inputSchema`, so v5 tools work by accident

#### ✅ File 5: `server/tools.test.ts` - **1 FAILURE** 🚨

**Bug confirmed: v5 tools get wrong execute signature in server handlers**

```
✓ v4 tools execute correctly (1 pass)
✗ v5 tools receive WRONG signature (1 fail):
  - Expected: execute({ query: 'test-query' }, options)
  - Actual: execute({ context: { query: 'test-query' }, mastra, runId, runtimeContext, ... }, options)
✓ Mastra tools receive correct signature (1 pass)
```

**Impact:** Server handlers calling v5 tools will cause **RUNTIME FAILURE**

#### ✅ File 6: `agent/isVercelTool-agent-integration.test.ts` - **2 FAILURES**

**Bug confirmed: v5 tools don't get properties set through agent**

```
✓ Agent with v4 tools - registers and sets id (1 pass)
✗ Agent with v5 tools - missing id property (1 fail):
  - v5 tool processed but no id set
✓ Agent with provider v5 tools - already have id (1 pass)
✓ Agent with Mastra tools - pass through correctly (1 pass)
✗ Mixed tool types - v5 tool missing id (1 fail):
  - v4 and Mastra tools work, v5 tool missing id
```

**Impact:** V5 tools registered with agents don't get required `id` property

### Phase 3: Bug Impact Analysis

**CONFIRMED BUGS:**

1. ✅ **Type Guard Bug** - `isVercelTool` doesn't detect v5 tools (4 test failures)
2. ✅ **Property Setting Bug** - v5 tools missing `id` property (4 test failures)
3. ✅ **Execute Signature Bug** 🚨 **CRITICAL** - v5 tools get wrong parameters, will fail at runtime (4 test failures across builder, server, agent)

**NO BUG (works by accident):**

- ✅ client-js - else branch also converts `inputSchema`, so v5 tools work correctly despite going to wrong branch

**Why client-js works by accident:**
The `processClientTools` function has two branches:

- IF `isVercelTool(value)` → convert `parameters` to JSON schema
- ELSE → convert `inputSchema` to JSON schema

Because v5 tools fail the `isVercelTool` check, they go to the ELSE branch which is actually meant for Mastra tools. But since the else branch ALSO converts `inputSchema`, v5 tools work correctly. This is semantically wrong (v5 tools ARE Vercel tools) but functionally correct.

### Total Test Coverage

| File               | Tests Added | Failures | Status                        |
| ------------------ | ----------- | -------- | ----------------------------- |
| toolchecks.test.ts | 14          | 4        | ✅ Bug proven                 |
| utils.test.ts      | 4           | 2        | ✅ Bug proven                 |
| builder.test.ts    | 4           | 3        | ✅ **CRITICAL bug proven**    |
| client-js          | 6           | 0        | ✅ No bug (works by accident) |
| server             | 3           | 1        | ✅ **CRITICAL bug proven**    |
| agent integration  | 5           | 2        | ✅ Bug proven                 |
| **TOTAL**          | **36**      | **12**   | **3 critical bugs confirmed** |

### Phase 4: Investigation Complete - READY FOR USER REVIEW

**User's 4-Step Plan - COMPLETED:**

1. ✅ **Figure out why process-client-tools tests pass**
   - ANSWER: The else branch also converts `inputSchema`, so v5 tools work by accident
   - Documented in File 4 results above

2. ✅ **Find where processClientTools is used and add tests**
   - ANSWER: Used in agent.ts resource, already has tests via agent integration tests
   - Added comprehensive agent integration tests (File 6)

3. ✅ **Fix setup issues in server tools.test.ts**
   - COMPLETED: Fixed test setup (added mastra parameter, fixed tool ID lookups)
   - 1 test failure proving v5 tools receive wrong execute signature in server handlers

4. ✅ **Add tests for agent.test.ts**
   - COMPLETED: Created `agent/isVercelTool-agent-integration.test.ts`
   - 5 tests, 2 failures proving v5 tools don't get `id` property through agents

**Summary for Review:**

- **36 tests created** across 6 test files
- **12 failures** proving 3 distinct bugs
- **1 location with no bug** (client-js works by accident because else branch also handles inputSchema)
- **All test setup issues resolved**

## Detailed Test Coverage Analysis

### 1. toolchecks.test.ts ✅ COMPLETE

**Location:** `packages/core/src/tools/toolchecks.test.ts`
**Purpose:** Test `isVercelTool()` type guard
**Coverage:**

- ✅ v4 tool detection (parameters) - 2 tests PASS
- ❌ v5 tool detection (inputSchema) - 4 tests FAIL (proving bug)
  - Basic v5 tool
  - v5 with description
  - v5 with function schema
  - Provider-defined v5 tool
- ✅ Mastra tool exclusion - 2 tests PASS
- ✅ Hybrid tools (both parameters and inputSchema) - 1 test PASS
- ✅ Edge cases (undefined, null, plain objects) - 5 tests PASS
  **Gaps:** None

### 2. utils.test.ts ✅ COMPLETE

**Location:** `packages/core/src/utils.test.ts`
**Purpose:** Test `ensureToolProperties()` adds id to tools
**Coverage:**

- ✅ v4 tools get id and inputSchema - 1 test PASS
- ❌ v5 tools should get id - 1 test FAIL (proving bug)
- ✅ Provider-defined v5 tools - 1 test PASS (already has id)
- ✅ Mastra tools pass through unchanged - 1 test PASS
  **Gaps:** None

### 3. builder.test.ts ✅ COMPLETE

**Location:** `packages/core/src/tools/tool-builder/builder.test.ts`
**Purpose:** Test `CoreToolBuilder` execute signature
**Coverage:**

- ✅ v4 tool execute with AI SDK signature (args, options) - 1 test PASS
- ❌ v5 tool execute with AI SDK signature - 1 test FAIL (receives Mastra signature)
- ❌ Provider-defined v5 tool execute - 1 test FAIL (receives Mastra signature)
- ✅ Mastra tool execute with Mastra signature (context object) - 1 test PASS
  **Gaps:** None

### 4. server/tools.test.ts ✅ COMPLETE

**Location:** `packages/server/src/server/handlers/tools.test.ts`
**Purpose:** Test server handlers execute signature
**Coverage:**

- ✅ v4 tools execute with AI SDK signature - 1 test PASS
- ❌ v5 tools execute with AI SDK signature - 1 test FAIL (receives Mastra signature)
- ✅ Mastra tools execute with Mastra signature - 1 test PASS
  **Gaps:** None

### 5. client-js/process-client-tools.test.ts ✅ COMPLETE

**Location:** `client-sdks/client-js/src/utils/process-client-tools.test.ts`
**Purpose:** Test client-side schema conversion
**Coverage:**

- ✅ v4 parameter to JSON schema conversion - PASS
- ✅ v5 inputSchema to JSON schema conversion - PASS (works by accident!)
- ✅ Provider-defined v5 tools - PASS
- ✅ Edge cases (undefined, empty, Mastra tools) - PASS
  **Note:** All tests pass because else branch handles inputSchema conversion
  **Gaps:** None - but documents "works by accident" behavior

### 6. agent/**tests**/vercel-tool.test.ts ⚠️ INCOMPLETE

**Location:** `packages/core/src/agent/__tests__/vercel-tool.test.ts`
**Purpose:** Test agent tool processing
**Current Coverage:**

- ✅ v4 tools get id through agent.getTools() - 1 test PASS
- ❌ v5 tools should get id through agent.getTools() - 2 tests FAIL (proving bug)
- ✅ Mastra tools pass through unchanged - 1 test PASS
- ✅ Mixed tool types - 1 test with partial failures

**Missing:**

- ❌ Execute signature tests (agent actually calling tools)
- Need: v4 tool execution test
- Need: v5 tool execution test (should FAIL)
- Need: Mastra tool execution test

**Next Steps - PENDING USER REVIEW:**

1. ⏳ Review all test results and findings
2. ⏳ Decide what additional tests to add to agent/**tests**/vercel-tool.test.ts
3. ⏳ Decide on fix approach:
   - **Option A:** Simple fix - `'parameters' in tool || 'inputSchema' in tool`
   - **Option B:** Separate type guards for v4 vs v5
   - **Option C:** Other approach
4. ⏳ Apply chosen fix
5. ⏳ Verify all 12 failing tests pass after fix
6. ⏳ Create changeset and update PR

## Next Steps

1. ✅ Bugs identified and documented
2. ⏳ Create simple mock tests for execute signature
3. ⏳ Fix CoreToolBuilder integration tests
4. ⏳ Create tests for other usage locations
5. ⏳ Verify all tests fail (prove bugs exist)
6. ⏳ Implement fix for `isVercelTool`
7. ⏳ Verify all tests pass
8. ⏳ Create changeset and PR

## Quick Test Reference

Run all tests to see the 14 failures:

```bash
cd /Users/naiyer/Documents/Projects/mastra-org/main/mastra/packages/core

# Test 1: Type guard tests (4 failures)
pnpm test src/tools/toolchecks.test.ts

# Test 2: Property setting tests (2 failures)
pnpm test src/utils.test.ts

# Test 3: Execute signature tests - CRITICAL (3 failures)
pnpm test src/tools/tool-builder/builder.test.ts

# Test 4: Client processing (0 failures - no bug)
cd ../client-sdks/client-js
pnpm test src/utils/process-client-tools.test.ts

# Test 5: Server handler tests (3 failures - test setup issues)
cd ../../packages/server
pnpm test src/server/handlers/tools.test.ts

# Test 6: Agent integration tests (2 failures)
cd ../core
pnpm test src/agent/isVercelTool-agent-integration.test.ts
```

Single command to run core tests:

```bash
cd packages/core
pnpm test toolchecks.test.ts utils.test.ts builder.test.ts src/agent/isVercelTool-agent-integration.test.ts
```

## Files Involved

- `packages/core/src/tools/toolchecks.ts` - Main type guard
- `packages/core/src/tools/toolchecks.test.ts` - Test coverage
- `packages/core/src/tools/tool-builder/builder.ts` - Execute logic
- `packages/core/src/utils.ts` - Property setting
- `packages/_external-types/src/index.ts` - Type definitions
