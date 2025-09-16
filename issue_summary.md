# Task: Migrate createRun() to createRunAsync()

## Context

The `createRun()` method in `packages/core/src/workflows/workflow.ts` is deprecated and shows a warning that it will be removed on September 16th, 2025. We need to update all internal usages to use `createRunAsync()` instead before today's release.

## Current Status

- **PR #7891** exists but does NOT handle this migration (it handles other deprecation fixes)
- The deprecation warning is on line 918 of `packages/core/src/workflows/workflow.ts`
- `createRunAsync()` already exists and is ready to use (starting at line 923)

## What Needs to Be Done

### 1. Update all internal createRun() calls to createRunAsync()

The main difference is that `createRunAsync()` is async, so you need to:

- Change `workflow.createRun()` to `await workflow.createRunAsync()`
- Ensure the calling function is async if it isn't already

### 2. Files that need updating (100+ occurrences found):

#### Core Package Files

- `packages/core/src/workflows/legacy/utils.ts` (line 319)
- `packages/server/src/server/handlers/legacyWorkflows.ts` (lines 106, 180)
- `packages/playground/src/hooks/use-workflows.ts` (lines 89, 102)
- `packages/playground-ui/src/hooks/use-workflows.ts` (line 99)
- `packages/mcp/src/server/server.ts` (needs investigation for workflow.createRun().start() pattern)

#### Test Files (may not need updating if testing the deprecated method specifically)

- `packages/core/src/workflows/workflow.test.ts` (multiple occurrences)
- `packages/core/src/workflows/legacy/workflow-legacy.test.ts` (multiple occurrences)
- `packages/server/src/server/handlers/workflows.test.ts` (multiple occurrences)
- `packages/server/src/server/handlers/legacyWorkflows.test.ts` (multiple occurrences)
- `packages/server/src/server/handlers/agent-builder.test.ts` (multiple occurrences)

#### Template Files

- `templates/weather-agent/src/mastra/workflows/index.ts`
- `templates/template-ad-copy-from-content/src/mastra/workflows/ad-copy-generation-workflow.ts`
- `templates/template-deep-research/src/mastra/workflows/generateReportWorkflow.ts`
- `templates/template-deep-research/src/mastra/workflows/researchWorkflow.ts`
- Other template files with workflow examples

#### Example Files in docs/examples

- Various example files that demonstrate workflow usage

### 3. Special Considerations

#### Pattern Changes Required

When you see this pattern:

```typescript
const run = workflow.createRun();
await run.start();
```

It should become:

```typescript
const run = await workflow.createRunAsync();
await run.start();
```

Or for the combined pattern:

```typescript
const result = await workflow.createRun().start({ inputData: {} });
```

Should become:

```typescript
const run = await workflow.createRunAsync();
const result = await run.start({ inputData: {} });
```

### 4. Testing Strategy

1. Run the build first: `pnpm build`
2. Run tests to ensure nothing breaks: `pnpm test`
3. Pay special attention to workflow tests

### 5. PR Creation

You can either:

- Add these changes to PR #7891 (owned by epinzur)
- Create a new PR specifically for this migration

The changes are straightforward but numerous. The key is to be systematic and ensure all occurrences are updated.

## Command to Find All Occurrences

```bash
# Find all createRun() calls in the codebase
grep -r "\.createRun(" packages/ templates/ examples/ --include="*.ts" --include="*.tsx"
```

## Branch Information

- Working directory: `/Users/tylerbarnes/code/mastra-ai/mastra--exp-deprecation-notices`
- Current branch: `esp/updated_methods` (PR #7891)
- You may want to create a new branch from main for this work

## Urgency

This needs to be completed before today's release to avoid shipping deprecated method usage in our own code.
