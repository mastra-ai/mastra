# Shared generic tool UI implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the current Factory generic tool-call representation from `@mastra/playground-ui` and use it for generic tool calls in both Factory UI and Playground.

**Architecture:** Move the accepted Factory presentation and card behavior into a provider-independent `ToolCall` component under the Playground UI AI namespace. Factory adapts its transcript `ToolCall` model to the public props, while Playground keeps its current tool dispatcher and replaces only the generic `ToolBadge` fallback. Factory retains consecutive-call grouping and Playground retains all Mastra-owned custom renderers.

**Tech Stack:** React 19, strict TypeScript, Tailwind CSS 4, Vitest, Testing Library, Storybook, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-17-shared-generic-tool-ui-design.md`

## Global constraints

- The current Factory UI is the exact visual and behavioral source of truth.
- Do not redesign, approximate, or replace its row, rail, diff, command, status, or animation treatment.
- Only the Playground generic fallback changes. Mastra-owned custom tool renderers remain unchanged.
- Keep `ToolGroup` and consecutive-part collection in Factory UI.
- Follow RED, GREEN, REFACTOR for every production change.
- Use Vitest and Testing Library for shared presentation tests. Use existing Mock Service Worker application tests where network context is required.
- Add one changeset per changed publishable package through the repository changeset command.

---

### Task 1: Move tool presentation into Playground UI

**Files:**

- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-presentation.test.ts`
- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-presentation.ts`

**Interfaces:**

- Consumes: `toolName: string` and `input: unknown`.
- Produces: `presentTool(toolName, input): ToolPresentation`, where `ToolPresentation` contains the current Factory `icon`, `label`, optional `detail`, and optional `command`.

- [ ] **Step 1: Write the failing presentation tests**

Copy the behavioral cases from Factory's `tool-presentation.test.ts` into the new package and retain assertions for workspace aliases, terminal commands, quoted and unquoted `cd` prefixes, unknown tool names, and missing streamed input.

```ts
describe('presentTool', () => {
  it('maps workspace aliases to humanized actions', () => {
    expect(presentTool('view', { path: 'src/a.ts' })).toMatchObject({ label: 'Read', detail: 'src/a.ts' });
  });

  it('keeps the full command while hiding the workspace preamble in the row', () => {
    const command = "cd '/repo with spaces' && pnpm test";
    expect(presentTool('execute_command', { command })).toMatchObject({
      label: 'Run',
      detail: 'pnpm test',
      command,
    });
  });

  it('prettifies an unknown tool name', () => {
    expect(presentTool('fetch_pull_request', undefined).label).toBe('Fetch pull request');
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```sh
pnpm --filter ./packages/playground-ui exec vitest run src/ds/components/ai/tool-call/tool-presentation.test.ts
```

Expected: FAIL because `tool-presentation.ts` does not exist.

- [ ] **Step 3: Move the Factory presentation implementation unchanged**

Move the icon mapping, argument readers, `prettifyToolName`, `withoutCdPrefix`, and `presentTool` from Factory into the new file. Keep all current aliases and labels.

```ts
export interface ToolPresentation {
  icon: LucideIcon;
  label: string;
  detail?: string;
  command?: string;
}

export function presentTool(toolName: string, input: unknown): ToolPresentation {
  const style = TOOL_STYLES[toolName.replace(/^mastra_workspace_/, '')];
  if (!style) return { icon: Wrench, label: prettifyToolName(toolName) };

  const detail = style.detailKeys ? firstStringArg(input, style.detailKeys) : undefined;
  if (!detail) return { icon: style.icon, label: style.label };
  if (!style.isCommand) return { icon: style.icon, label: style.label, detail };
  return { icon: style.icon, label: style.label, detail: withoutCdPrefix(detail), command: detail };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the presentation move**

```sh
git add packages/playground-ui/src/ds/components/ai/tool-call/tool-presentation.ts packages/playground-ui/src/ds/components/ai/tool-call/tool-presentation.test.ts
git commit -m "feat(playground-ui): add generic tool presentation"
```

### Task 2: Publish the exact Factory generic tool component

**Files:**

- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.test.tsx`
- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.tsx`
- Create: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.stories.tsx`
- Create: `packages/playground-ui/src/ds/components/ai/tool-call/index.ts`
- Modify: `packages/playground-ui/src/components-exports.test.ts`

**Interfaces:**

- Consumes: `ToolCallProps` from the approved spec.
- Produces: Public `ToolCall`, `ToolCallProps`, and `ToolCallStatus` exports at `@mastra/playground-ui/components/ai/tool-call`.
- Depends on: `presentTool` from Task 1 and existing Playground UI `Code`, `CodeBlock`, `Collapsible`, `CopyButton`, `Shimmer`, `Txt`, and `cn` entries.

- [ ] **Step 1: Write the failing component tests**

Add focused tests for the exact Factory behavior. Use a local `renderTool` helper and real design-system components.

```tsx
describe('ToolCall', () => {
  it('renders a running command with the Factory row semantics', () => {
    render(<ToolCall toolName="execute_command" input={{ command: 'pnpm test' }} status="running" />);
    const tool = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(tool).toHaveAttribute('aria-busy', 'true');
    expect(within(tool).getByText('Run')).toBeInTheDocument();
    expect(within(tool).getByText('pnpm test')).toBeInTheDocument();
  });

  it('renders failure while leaving success visually quiet', () => {
    const { rerender } = render(<ToolCall toolName="write_file" input={{}} status="error" />);
    expect(screen.getByRole('img', { name: 'Failed' })).toBeInTheDocument();
    rerender(<ToolCall toolName="write_file" input={{}} status="success" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('opens command, diff, write, and generic bodies', async () => {
    const user = userEvent.setup();
    render(<ToolCall toolName="string_replace" input={{ path: 'a.ts', old_string: 'a', new_string: 'b' }} status="success" />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('group', { name: 'File change' })).toBeInTheDocument();
  });

  it('keeps pending extension content open and actionable', () => {
    render(
      <ToolCall toolName="charge_card" input={{ amount: 10 }} status="running" defaultOpen>
        <button type="button">Approve</button>
      </ToolCall>,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
  });
});
```

Add cases for raw and escaped ANSI, circular input, `false`, `0`, `null`, empty strings, header actions, arrival classes, fallback highlighting, copy controls, and the 200-line diff bound.

- [ ] **Step 2: Verify the component tests fail for the missing public component**

Run:

```sh
pnpm --filter ./packages/playground-ui exec vitest run src/ds/components/ai/tool-call/tool-call.test.tsx
```

Expected: FAIL because `tool-call.tsx` does not exist.

- [ ] **Step 3: Move the Factory component into the shared package**

Move the current `ToolCard` implementation, row shell, rail constants, diff view, monospace blocks, edit detection, stringification, truncation, language mapping, and serialized ANSI stripping. Rename only the public surface from `ToolCard` to `ToolCall`.

```ts
export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallProps extends HTMLAttributes<HTMLDivElement> {
  toolName: string;
  input?: unknown;
  result?: unknown;
  output?: string;
  status: ToolCallStatus;
  defaultOpen?: boolean;
  headerActions?: ReactNode;
  children?: ReactNode;
}
```

Preserve the current Factory CSS classes. Append `headerActions` before the failure/trailing state area. Append `children` after the standard body fields. Keep the disclosure open if `defaultOpen` becomes true after mount so pending approvals cannot stay hidden.

- [ ] **Step 4: Export the public component and add an export contract test**

```ts
export { ToolCall } from './tool-call';
export type { ToolCallProps, ToolCallStatus } from './tool-call';
export { presentTool } from './tool-presentation';
export type { ToolPresentation } from './tool-presentation';
```

Add to `components-exports.test.ts`:

```ts
it('AI tool-call entry exports ToolCall', async () => {
  const mod = await import('./ds/components/ai/tool-call');
  expect(mod.ToolCall).toBeDefined();
});
```

- [ ] **Step 5: Add stories that expose visual regressions**

Create stories titled `AI/Tool Call` for `RunningCommand`, `SuccessfulCommand`, `FailedTool`, `StringReplace`, `FileWrite`, `UnknownTool`, and `PendingAction`. Render each in the same fixed-width transcript-like container and use the shared component directly.

- [ ] **Step 6: Verify tests and typecheck pass**

Run:

```sh
pnpm --filter ./packages/playground-ui exec vitest run src/ds/components/ai/tool-call/tool-call.test.tsx src/ds/components/ai/tool-call/tool-presentation.test.ts src/components-exports.test.ts
pnpm --filter ./packages/playground-ui typecheck
```

Expected: PASS with no diagnostics.

- [ ] **Step 7: Commit the shared component**

```sh
git add packages/playground-ui/src/ds/components/ai/tool-call packages/playground-ui/src/components-exports.test.ts
git commit -m "feat(playground-ui): publish generic tool call UI"
```

### Task 3: Migrate Factory to the shared component

**Files:**

- Modify: `mastracode/factory-ui/src/ui/domains/chat/components/Transcript.tsx`
- Modify: `mastracode/factory-ui/src/ui/domains/chat/components/tool/ToolGroup.tsx`
- Modify: `mastracode/factory-ui/src/ui/domains/chat/components/__tests__/TranscriptToolRows.msw.test.tsx`
- Delete: `mastracode/factory-ui/src/ui/domains/chat/components/tool/ToolCard.tsx`
- Delete: `mastracode/factory-ui/src/ui/domains/chat/components/tool/tool-presentation.ts`
- Delete: `mastracode/factory-ui/src/ui/domains/chat/components/tool/tool-presentation.test.ts`

**Interfaces:**

- Consumes: Shared `ToolCall` and `ToolCallStatus`.
- Produces: A local adapter from Factory's transcript `ToolCall` model to shared props.
- Preserves: Factory grouping, transcript ordering, special `ToolFactory` renderers, stale runtime-state resolution, and current accessible names.

- [ ] **Step 1: Add a failing integration assertion for shared-only behavior**

Extend the Factory transcript test to open a generic command and assert the exact shared body plus existing row semantics.

```tsx
it('renders generic tool details through the shared Factory representation', async () => {
  renderEntries([assistantMessage('msg-1', [doneTool('call-1', 'execute_command', { command: 'pnpm test' })])]);
  const row = screen.getByRole('group', { name: 'Tool: execute_command' });
  await userEvent.click(within(row).getByRole('button'));
  expect(within(row).getByText('$')).toBeInTheDocument();
  expect(within(row).getByText('pnpm test')).toBeInTheDocument();
});
```

Temporarily import `ToolCall` from the new public entry in the expected code path or remove the local component before running so the test proves the migration path is unresolved.

- [ ] **Step 2: Verify RED after removing the local implementation import**

Run:

```sh
pnpm --filter ./mastracode/factory-ui exec vitest run --project msw:factory-ui src/ui/domains/chat/components/__tests__/TranscriptToolRows.msw.test.tsx
```

Expected: FAIL because the transcript still references the removed local component or lacks the adapter.

- [ ] **Step 3: Add the Factory adapter and switch both call sites**

```tsx
function GenericToolCall({ tool }: { tool: TranscriptToolCall }) {
  const status: ToolCallStatus =
    tool.status === 'running' ? 'running' : tool.status === 'error' ? 'error' : 'success';

  return (
    <ToolCall
      toolName={tool.toolName}
      input={tool.args ?? tool.argsText}
      result={tool.result}
      output={tool.output}
      status={status}
    />
  );
}
```

Use the adapter in Transcript's fallback and inside `ToolGroup`. Import `presentTool` from the shared entry for the group header. Do not duplicate the mapping.

- [ ] **Step 4: Remove the old Factory files and run focused tests**

Run:

```sh
pnpm --filter ./mastracode/factory-ui exec vitest run --project msw:factory-ui src/ui/domains/chat/components/__tests__/TranscriptToolRows.msw.test.tsx
pnpm --filter ./mastracode/factory-ui typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the Factory migration**

```sh
git add mastracode/factory-ui/src/ui/domains/chat/components
git commit -m "refactor(factory-ui): use shared generic tool UI"
```

### Task 4: Migrate Playground's generic fallback

**Files:**

- Modify: `packages/playground/src/lib/ai-ui/tools/tool-card.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/__tests__/tool-card.test.tsx`
- Delete: `packages/playground/src/lib/ai-ui/tools/badges/tool-badge.tsx`
- Delete: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/tool-badge.test.tsx`

**Interfaces:**

- Consumes: Shared `ToolCall`, Playground v4/v5 part state, metadata dialogs, approval controls, and current generic payload.
- Produces: `genericToolStatus(state, output): ToolCallStatus` and a generic fallback using the shared component.
- Preserves: Hook order, browser registration, skill activation, workflow streaming, every custom renderer branch, MCP App result rendering, approvals, suspensions, network metadata, and background metadata.

- [ ] **Step 1: Change generic dispatcher tests first**

Replace the old raw-name fallback assertion with assertions unique to the Factory representation, and add error, internal-input filtering, approval, and custom-renderer regressions.

```tsx
it('renders an unknown generic tool through the Factory representation', () => {
  renderToolCard(baseProps({ toolName: 'search_docs', input: { query: 'tools' } }));
  const row = screen.getByRole('group', { name: 'Tool: search_docs' });
  expect(within(row).getByText('Search docs')).toBeInTheDocument();
  expect(within(row).queryByText('search_docs')).not.toBeInTheDocument();
});

it('maps terminal error states to the shared failure treatment', () => {
  renderToolCard(baseProps({ toolName: 'search_docs', state: 'output-error', output: { error: 'boom' } }));
  expect(screen.getByRole('img', { name: 'Failed' })).toBeInTheDocument();
});
```

Keep explicit existing assertions for observation, agent, workflow, file-tree, sandbox, Code Mode, ask-user, task suppression, and MCP App branches.

- [ ] **Step 2: Run the dispatcher test and verify RED**

Run:

```sh
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/tools/__tests__/tool-card.test.tsx
```

Expected: FAIL because the generic fallback still renders `ToolBadge` and exposes the raw title.

- [ ] **Step 3: Implement state and input adapters**

```ts
function genericToolStatus(state: string | undefined, output: unknown): ToolCallStatus {
  if (state === 'output-error' || state === 'output-denied') return 'error';
  if (state === 'output-available' || state === 'result' || output !== undefined) return 'success';
  return 'running';
}

function genericToolInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const { __mastraMetadata: _metadata, _background, ...visible } = input as Record<string, unknown>;
  return visible;
}
```

- [ ] **Step 4: Replace only the generic fallback**

Render shared `ToolCall` with the normalized input and status. Pass the current network/background metadata trigger as `headerActions`. Append suspend payload, additional tool output, and `ToolApprovalButtons` as body extensions. Set `defaultOpen` when approval or suspension metadata exists.

Do not move or rewrite any custom branch. Keep `McpAppToolResult` next to the generic shell exactly as it is today.

- [ ] **Step 5: Remove the old fallback component after verifying no imports remain**

Run:

```sh
rg -n "ToolBadge" packages/playground/src
```

The search must show only the old component and its focused test after the fallback changes. Delete both files. Keep `BadgeWrapper` because agent, workflow, Code Mode, and loading components still use it.

- [ ] **Step 6: Verify Playground tests and typecheck**

Run:

```sh
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/tools/__tests__/tool-card.test.tsx src/lib/ai-ui/messages/__tests__/message-row.test.tsx
pnpm --filter ./packages/playground typecheck
```

Expected: PASS, including all custom-renderer regressions.

- [ ] **Step 7: Commit the Playground migration**

```sh
git add packages/playground/src/lib/ai-ui/tools packages/playground/src/lib/ai-ui/messages
git commit -m "refactor(playground): use shared generic tool UI"
```

### Task 5: Add release notes and verify the complete change

**Files:**

- Create through the repository CLI: Three generated files under `.changeset/`, one for each affected release surface.

**Interfaces:**

- Produces: Release notes for the new public Playground UI component and visible Playground generic tool migration.

- [ ] **Step 1: Create package-specific changesets**

Run:

```sh
pnpm changeset -s -m "Added the Factory tool-call representation as a reusable component for consistent generic tool output." --minor @mastra/playground-ui
pnpm changeset -s -m "Improved generic tool calls in Studio so they use the same compact, humanized representation as MastraCode Factory." --patch mastra
pnpm changeset -s -m "Kept generic tool calls in MastraCode Factory on the shared canonical tool-call representation." --patch @mastra/factory
```

These package targets match the existing release surfaces for shared Playground UI, Studio, and the Factory UI bundle.

- [ ] **Step 2: Run focused test suites**

```sh
pnpm --filter ./packages/playground-ui test --run
pnpm --filter ./packages/playground exec vitest run src/lib/ai-ui/tools/__tests__/tool-card.test.tsx src/lib/ai-ui/messages/__tests__/message-row.test.tsx
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
```

Expected: All suites pass without warnings caused by this change.

- [ ] **Step 3: Run typechecks and builds**

```sh
pnpm --filter ./packages/playground-ui typecheck
pnpm --filter ./packages/playground-ui build
pnpm --filter ./packages/playground typecheck
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

Expected: All commands exit 0.

- [ ] **Step 4: Run targeted lint checks**

```sh
pnpm --filter ./packages/playground-ui lint
pnpm --filter ./packages/playground lint
```

Expected: No lint errors in changed files.

- [ ] **Step 5: Inspect the final diff and changeset coverage**

```sh
git diff --check HEAD~4
git status --short
git diff --stat HEAD~4
```

Confirm that no specialized Playground renderer changed and no Factory UI copy of the generic component remains.

- [ ] **Step 6: Commit release notes and verification-ready state**

```sh
git add .changeset
git commit -m "chore: add shared tool UI changesets"
```
