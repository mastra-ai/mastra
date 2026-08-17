# Shared generic tool UI design

## Goal

Make the current MastraCode Factory tool-call UI the single source of truth for generic tool calls. Publish that UI from `@mastra/playground-ui`, then use it in both Factory UI and Playground without changing Mastra-owned custom tool renderers.

## Source of truth

The Factory implementation is the accepted design. The extraction must preserve its current structure, spacing, typography, icons, colors, disclosure behavior, animation, status treatment, command view, file-edit view, and generic argument/result view.

This work moves the Factory representation. It does not reinterpret it with similar design-system components or redesign it while extracting it.

The source implementation consists of:

- `mastracode/factory-ui/src/ui/domains/chat/components/tool/ToolCard.tsx`
- `mastracode/factory-ui/src/ui/domains/chat/components/tool/tool-presentation.ts`
- The tool-row structure and rail styles currently supplied by `TranscriptRow.tsx`

`ToolGroup` remains transcript orchestration owned by Factory UI. It will render the shared generic tool component for each member.

## Scope

The shared component replaces generic tool fallbacks only.

Factory UI will use the shared component wherever it currently renders its local generic `ToolCard`.

Playground will use the shared component in the generic fallback that currently renders `ToolBadge`. The dispatcher will continue to select the existing custom UI for Mastra-owned tool types, including:

- Agent tools
- Ask-user tools
- Code Mode tools
- File-tree and workspace tools
- Mastra Memory observation markers
- Model Context Protocol (MCP) App results
- Sandbox execution tools
- Workflow tools

Approval controls, suspension controls, network routing metadata, background-task metadata, and additional tool output remain application concerns. Playground can place those controls in extension slots without changing the shared visual shell.

## Shared component

Add a public component entry at `@mastra/playground-ui/components/ai/tool-call`.

The entry exports:

```ts
export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallProps extends React.HTMLAttributes<HTMLDivElement> {
  toolName: string;
  input?: unknown;
  result?: unknown;
  output?: string;
  status: ToolCallStatus;
  defaultOpen?: boolean;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}

export function ToolCall(props: ToolCallProps): React.ReactElement;
```

`headerActions` carries application-specific metadata affordances in the row. `children` appends application-specific controls or sections to the expanded body. `defaultOpen` lets a pending approval remain visible and actionable on first render.

The component stays provider-independent. It must not read Playground or Factory contexts, query clients, message metadata, or transport state.

## Presentation behavior

Move the current Factory presentation mapping into the shared entry. Known tool names keep their current humanized action, icon, and salient argument. The `mastra_workspace_` prefix remains transparent. Unknown names keep the current prettified fallback with the wrench icon.

The collapsed row preserves the current Factory behavior:

- The leading icon identifies the action.
- The label and salient argument use the current typography and truncation.
- A running call shimmers and sets `aria-busy="true"`.
- A failed call shows the current red cross.
- A successful call remains visually quiet.
- The chevron and hover treatment match the current Factory row.
- A call that mounts while running keeps the current motion-safe arrival animation.

The expanded body preserves the current Factory behavior:

- Command tools show the command and terminal output in monospace blocks.
- String-replace and edit tools show the current bounded two-sided diff.
- Write and create tools show the current source-code block.
- Other tools show serialized input, streamed output, and terminal result when available.
- Copy controls, maximum heights, truncation limits, ANSI removal, colors, rail, and spacing match Factory UI.

Falsy values such as `false`, `0`, `""`, and `null` must not be lost through truthiness checks. Partial streamed input and values that cannot be serialized as JSON must render without throwing.

## Consumer adapters

### Factory UI

Factory maps its existing transcript model as follows:

```ts
const status =
  tool.status === 'running' ? 'running' :
  tool.status === 'error' ? 'error' :
  'success';
```

It passes `toolName`, `args`, `result`, and streamed `output` directly to the shared component. Factory's local `ToolCard` and `tool-presentation` implementation are removed after their tests move to the shared package.

`ToolGroup` stays local because collecting consecutive message parts is transcript orchestration, not presentation. Its expanded members use the shared `ToolCall` component.

### Playground

Playground retains the existing dispatcher and all hooks that run before its conditional renderers. Only the generic `ToolBadge` fallback changes.

The adapter normalizes message-part states:

- `output-error` and `output-denied`: `error`
- `output-available` and `result`: `success`
- A defined output without a terminal state: `success`
- Every other state: `running`

Before passing generic input, Playground removes its existing internal `__mastraMetadata` and `_background` fields. Network and background metadata triggers use `headerActions`. Approval and suspension controls use the expanded-body extension and set `defaultOpen` when user action is pending. Additional `toolOutput` content remains available through the expanded body.

The specialized branches continue to return before the generic fallback. Their component code and visual behavior remain unchanged.

## Accessibility

The shared component keeps the Factory semantics:

- The root uses `role="group"` and an accessible name derived from the raw tool name.
- Running state uses `aria-busy`.
- Failure has an accessible `Failed` label.
- The disclosure uses the design-system collapsible trigger and remains keyboard operable.
- Decorative icons stay hidden from assistive technology.
- Motion stops under `prefers-reduced-motion` through the existing motion-safe class.

Extension content must remain reachable after opening the disclosure. Pending approval content starts open.

## Failure handling

The shared UI must degrade to readable plain text when syntax highlighting cannot identify a language or fails. Circular and otherwise non-JSON-serializable values fall back to `String(value)`. ANSI sequences are removed from terminal and serialized result text.

Unknown tool names are valid input and use the current Factory fallback. Missing streamed arguments omit the detail until it becomes available. The component does not throw for missing input, result, or output.

## Tests and stories

### Playground UI

Move the pure `presentTool` tests from Factory UI and add component tests for:

- Known and unknown tool presentation
- Running, successful, and failed states
- Disclosure interaction and keyboard-accessible semantics
- Shell commands with and without a workspace `cd` prefix
- String replacement, file write, generic input, output, and result bodies
- Falsy, missing, malformed, and circular values
- Default-open and extension-slot behavior
- Arrival animation and accessible status attributes
- Public package export

Add Storybook stories for a running command, successful command, failed tool, string-replace diff, file write, unknown generic tool, and pending action with extension content. Stories use the exact shared component and provide a fixed-width transcript-like container for visual review.

### Factory UI

Adapt the existing transcript tool-row tests to assert the shared component keeps the current humanized labels, status semantics, grouping behavior, stale-runtime handling, and expanded content.

### Playground

Adapt dispatcher tests to prove:

- An unknown generic tool renders through the shared Factory representation.
- Terminal state normalization reaches the shared status treatment.
- Pending generic approvals remain usable.
- Each existing Mastra-owned specialized branch still renders its custom component.

Tests follow the repository's Vitest and Mock Service Worker conventions. Network boundaries remain the only mocked application boundary.

## Verification

Run the narrow package checks first:

```sh
pnpm --filter ./packages/playground-ui test --run
pnpm --filter ./packages/playground-ui typecheck
pnpm --filter ./packages/playground-ui build
pnpm --filter ./packages/playground test --run
pnpm --filter ./packages/playground typecheck
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

Run targeted lint commands for changed packages if the focused test, typecheck, and build gates pass.

## Release notes

Add a patch changeset for `@mastra/playground-ui` because it gains a public component. Add the package changes required by the repository changeset command for Playground or Factory consumers.

## Out of scope

- Changing any Mastra-owned specialized tool UI
- Grouping consecutive tools in Playground
- Moving Factory transcript collection or message-part orchestration into the design system
- Redesigning the accepted Factory UI
- Changing tool execution, streaming, approvals, or transport behavior

## Acceptance criteria

- Factory's generic tool calls look and behave as they do before the extraction.
- Playground generic tool calls use that same published component.
- Playground's Mastra-owned custom tool renderers remain unchanged.
- The shared component has tests, stories, and a public package export.
- Focused tests, typechecks, builds, and lint checks pass for all changed packages.
- Required changesets describe the shared UI and consumer migration.
