# Unified tool UI review fixes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the accessible selectors, pending-action visibility, Shiki loading, and tool-rail adjacency regressions in pull request #21760.

**Architecture:** Keep the shared tool-call API stable. Reuse one asynchronous highlighting primitive, apply one approval-state policy across badge consumers, and derive rail continuity from the filtered render sequence.

**Tech Stack:** React, strict TypeScript, Vitest, Testing Library, MSW, Playwright, Shiki, pnpm, Turborepo

**Spec:** `docs/superpowers/specs/2026-08-18-unified-tool-ui-review-fixes-design.md`

## Global constraints

- Do not modify examples.
- Do not add a public tool status or restore `tool-args` and `tool-result` test IDs.
- Use accessible roles and names for browser selectors.
- Write and run each failing regression test before changing production code.
- Preserve existing collapsed behavior when no approval or suspension action is pending.
- Use the narrowest package test, typecheck, lint, and build commands.

---

### Task 1: Connect rails only between adjacent rendered tools

**Files:**

- Modify: `packages/playground/src/lib/ai-ui/messages/message-row.tsx`
- Test: `packages/playground/src/lib/ai-ui/messages/__tests__/message-row.test.tsx`

**Interfaces:**

- Consumes: `displayMessage.content.parts`, already filtered by `withRenderableParts`
- Produces: `Set<object>` containing only tool parts whose next rendered sibling is another tool part

- [ ] **Step 1: Add failing adjacency tests**

Add BDD cases that render `tool -> text -> tool` and `tool -> reasoning -> tool`, then assert that no `[data-tool-call-rail]` exists. Add a case with `tool -> hidden tool -> tool` and assert that exactly one rail connects the two visible tools.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/messages/__tests__/message-row.test.tsx
```

Expected: The text and reasoning cases fail because the first tool incorrectly receives a rail.

- [ ] **Step 3: Replace all-tool indexing with rendered adjacency**

In `MessageRow`, compute the continuation set once:

```tsx
const continuedToolParts = useMemo(() => {
  const parts = displayMessage?.content.parts ?? []
  const continued = new Set<object>()

  for (let index = 0; index < parts.length - 1; index += 1) {
    if (getToolPartName(parts[index]) && getToolPartName(parts[index + 1])) {
      continued.add(parts[index])
    }
  }

  return continued
}, [displayMessage])
```

Pass `continued={continuedToolParts.has(part)}` from `renderToolPart`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: All `message-row` tests pass.

- [ ] **Step 5: Commit the rail fix**

```bash
git add packages/playground/src/lib/ai-ui/messages/message-row.tsx packages/playground/src/lib/ai-ui/messages/__tests__/message-row.test.tsx
git commit -m "fix(playground): connect only adjacent tool calls"
```

### Task 2: Keep approval and suspension actions visible

**Files:**

- Create: `packages/playground/src/lib/ai-ui/tools/badges/tool-action-state.ts`
- Create: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/tool-action-state.test.ts`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/tool-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/code-mode-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/agent-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/workflow-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/file-tree-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/sandbox-execution-badge.tsx`
- Test: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/tool-badge.test.tsx`
- Test: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/code-mode-badge.test.tsx`
- Test: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/agent-badge.test.tsx`
- Test: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/workflow-badge.test.tsx`
- Test: `packages/playground/src/lib/ai-ui/tools/__tests__/tool-card.test.tsx`

**Interfaces:**

- Produces: `isToolApprovalPending(toolApprovalMetadata: unknown, toolCalled: boolean): boolean`
- Consumers: Every badge that renders `ToolApprovalButtons`

- [ ] **Step 1: Change existing approval expectations to the required behavior**

For generic and code-mode badges, assert that `aria-expanded` is `true` and that **Approve** is available immediately. In `tool-card.test.tsx`, make the same assertion for `list_files`. Add a sandbox approval case. Add agent and workflow cases for approval or suspension payloads. Keep completed-without-action tests collapsed.

- [ ] **Step 2: Add and run a pure policy test**

Create a table-driven test for these literals:

```ts
expect(isToolApprovalPending(undefined, false)).toBe(false)
expect(isToolApprovalPending({ toolCallId: 'call-1' }, false)).toBe(true)
expect(isToolApprovalPending({ toolCallId: 'call-1' }, true)).toBe(false)
```

Run:

```bash
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/tools/badges/__tests__/tool-action-state.test.ts src/lib/ai-ui/tools/badges/__tests__/tool-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/code-mode-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/agent-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/workflow-badge.test.tsx src/lib/ai-ui/tools/__tests__/tool-card.test.tsx
```

Expected: The new helper import and immediate-action assertions fail.

- [ ] **Step 3: Implement the approval policy helper**

```ts
export function isToolApprovalPending(toolApprovalMetadata: unknown, toolCalled: boolean): boolean {
  return toolApprovalMetadata !== undefined && !toolCalled
}
```

- [ ] **Step 4: Pass pending-action state to uncontrolled badges**

For `ToolBadge` and `CodeModeBadge`, pass `defaultOpen={isToolApprovalPending(toolApprovalMetadata, toolCalled)}`. For `AgentBadge` and `WorkflowBadge`, include `Boolean(suspendPayload)` in the `defaultOpen` expression.

- [ ] **Step 5: Synchronize controlled file-tree and sandbox disclosures**

Compute `approvalPending` after each badge computes `toolCalled`. Initialize controlled disclosure state as collapsed, then synchronize it:

```tsx
useEffect(() => {
  setIsCollapsed(!approvalPending)
}, [approvalPending])
```

Import `useEffect` where required. This opens the body when approval arrives and returns the badge to its default collapsed state when the pending action is gone.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: All selected badge and dispatcher tests pass.

- [ ] **Step 7: Commit the pending-action fix**

```bash
git add packages/playground/src/lib/ai-ui/tools/badges packages/playground/src/lib/ai-ui/tools/__tests__/tool-card.test.tsx
git commit -m "fix(playground): expose pending tool actions"
```

### Task 3: Defer tool diff syntax highlighting

**Files:**

- Create: `packages/playground-ui/src/ds/components/Code/highlighted-code.tsx`
- Modify: `packages/playground-ui/src/ds/components/Code/code.tsx`
- Delete: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call-highlight.ts`
- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call-language.ts`
- Modify: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.tsx`
- Test: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.test.tsx`

**Interfaces:**

- Produces: `useHighlightedCode(code: string, lang?: string): HighlightedCode | null`
- Produces: `HighlightedTokenLine({ tokens }: { tokens: ThemedToken[] }): ReactNode`
- Produces: `languageForPath(path?: string): string | undefined`
- Consumes: asynchronous `highlight(code, lang)` from `CodeEditor/highlight.ts`

- [ ] **Step 1: Add the failing asynchronous diff test**

Open a TypeScript string-replace tool. Assert that both source lines are present synchronously and that no syntax-colored token span exists on the first render. Use `waitFor` to assert that `.shiki-token` spans arrive afterward.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter ./packages/playground-ui test --run src/ds/components/ai/tool-call/tool-call.test.tsx
```

Expected: The first-render assertion fails because the synchronous highlighter has already emitted styled spans.

- [ ] **Step 3: Extract the shared asynchronous hook and token renderer**

Move the `Highlighted` state, effect, usable-prefix check, and `tokenStyle` logic from `Code` into `highlighted-code.tsx`. Keep `Code` as the public `<pre>` wrapper and render lines through `HighlightedTokenLine`.

- [ ] **Step 4: Replace the tool-call highlighter**

Move only extension-to-language mapping into `tool-call-language.ts`. In `DiffSide`, join its bounded lines with `\n`, call `useHighlightedCode` once, and render each row from `highlighted?.tokens[index]` or the original plain line. Remove `dangerouslySetInnerHTML` and all synchronous Shiki imports.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: All tool-call tests pass, including immediate plain text and deferred tokens.

- [ ] **Step 6: Verify the package bundle**

Run:

```bash
pnpm build:playground-ui
```

Expected: The package builds and the tool-call entry no longer contains a synchronous Shiki highlighter.

- [ ] **Step 7: Commit the highlighting fix**

```bash
git add packages/playground-ui/src/ds/components/Code packages/playground-ui/src/ds/components/ai/tool-call
git commit -m "perf(playground-ui): defer tool diff highlighting"
```

### Task 4: Update streaming browser selectors

**Files:**

- Modify: `packages/playground/e2e/tests/agents/$agentId/stream.spec.ts`

**Interfaces:**

- Consumes: accessible groups `Tool: weatherInfo`, `Input`, and `Output`
- Produces: streaming coverage that works before and after page reload

- [ ] **Step 1: Scope the E2E helper to the tool group**

Replace `getByTestId('tool-args')` and `getByTestId('tool-result')` with:

```ts
const tool = page.getByTestId('thread-wrapper').getByRole('group', { name: 'Tool: weatherInfo' })
await tool.getByRole('button', { name: /weatherInfo/ }).click()
const input = tool.getByRole('group', { name: 'Input' })
const output = tool.getByRole('group', { name: 'Output' })
```

Keep the existing literal payload assertions on `input` and `output`.

- [ ] **Step 2: Run the focused Playwright test**

Run the package E2E setup, then:

```bash
pnpm --filter ./packages/playground exec playwright test -c e2e/playwright.config.ts 'e2e/tests/agents/$agentId/stream.spec.ts' --grep 'streams the tool call and result'
```

Expected: The tool result is verified before and after reload with no test-ID selector failures.

- [ ] **Step 3: Commit the selector migration**

```bash
git add 'packages/playground/e2e/tests/agents/$agentId/stream.spec.ts'
git commit -m "test(playground): use accessible tool payload selectors"
```

### Task 5: Validate the integrated change

**Files:**

- Modify: `.changeset/<generated-name>.md`

**Interfaces:**

- Consumes: All four completed fixes
- Produces: A merge-ready branch with package validation and release metadata

- [ ] **Step 1: Run targeted tests together**

```bash
pnpm --filter ./packages/playground-ui test --run src/ds/components/ai/tool-call/tool-call.test.tsx
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/messages/__tests__/message-row.test.tsx src/lib/ai-ui/tools/badges/__tests__/tool-action-state.test.ts src/lib/ai-ui/tools/badges/__tests__/tool-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/agent-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/code-mode-badge.test.tsx src/lib/ai-ui/tools/badges/__tests__/workflow-badge.test.tsx src/lib/ai-ui/tools/__tests__/tool-card.test.tsx
```

Expected: All selected tests pass with no warnings.

- [ ] **Step 2: Run typechecks and lint**

```bash
pnpm --filter ./packages/playground-ui typecheck
pnpm --filter ./packages/playground-ui lint
pnpm --filter ./packages/playground typecheck
pnpm --filter ./packages/playground lint
```

Expected: All commands exit successfully.

- [ ] **Step 3: Run builds**

```bash
pnpm build:playground-ui
pnpm turbo build --filter ./packages/playground
pnpm --filter ./mastracode/factory-ui build
```

Expected: Shared UI, Playground, and Factory UI builds succeed.

- [ ] **Step 4: Capture viewport evidence**

Run the tool-stream fixture and capture the expanded tool transcript at mobile, tablet, and desktop sizes. Verify visible input/output, approval controls, diff rows, and unbroken focus outlines.

- [ ] **Step 5: Add the required changeset**

Follow `.mastracode/commands/changeset.md`. Add a patch changeset for `@mastra/playground-ui` describing deferred diff highlighting and a patch changeset for the Playground package if it is publishable.

- [ ] **Step 6: Review the final diff**

```bash
git diff --check
git status --short
git diff review/pr-21760...HEAD --stat
```

Expected: No whitespace errors, no unrelated files, and no example changes.

- [ ] **Step 7: Commit release metadata**

```bash
git add .changeset
git commit -m "chore: add tool UI fix changeset"
```
