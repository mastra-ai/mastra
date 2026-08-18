# Unify entity tool call UI implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every remaining legacy tool badge with the shared Factory `ToolCall` shell while preserving custom icons, custom bodies, and entity colors.

**Architecture:** Extend `ToolCall` with narrow presentation overrides and a non-collapsible state. Keep operation-specific presentation as the default, then migrate the Playground workflow, agent, Code Mode, and loading renderers without changing their custom expanded content.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Vitest, Testing Library, Storybook, Playwright.

**Spec:** User-approved design in the Codex task on 2026-08-17.

## Global constraints

- Preserve specific tool icons when they exist.
- Use `text-accent6` for tools, `text-accent3` for workflows, and `text-accent1` for agents.
- Preserve Mastra-specific custom content and interactions.
- Do not commit example-only tools added to Chef Model V2 for manual verification.
- Follow strict red-green-refactor test-driven development.

---

### Task 1: Extend the shared `ToolCall` presentation API

**Files:**

- Modify: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.tsx`
- Modify: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.test.tsx`
- Modify: `packages/playground-ui/src/ds/icons/ToolCoinIcon.tsx`

**Interfaces:**

- Produces: `ToolCallProps.icon`, `ToolCallProps.iconClassName`, `ToolCallProps.label`, and `ToolCallProps.collapsible`.
- Produces: A colorable `ToolCoinIcon` that uses `currentColor`.

- [ ] Add failing tests proving that a custom icon and label replace only the default presentation, the requested entity color reaches the icon, the default tool icon stays yellow, and a non-collapsible row has no disclosure control.
- [ ] Run the focused `ToolCall` test and confirm each new expectation fails for the missing API or behavior.
- [ ] Implement the smallest presentation overrides, default `text-accent6` tool color, and non-collapsible rendering needed to pass.
- [ ] Make `ToolCoinIcon` inherit its color without changing its shape.
- [ ] Run the focused test and confirm it passes.

### Task 2: Migrate legacy Playground badges

**Files:**

- Modify: `packages/playground/src/lib/ai-ui/tools/badges/workflow-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/agent-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/code-mode-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/loading-badge.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/workflow-badge.test.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/code-mode-badge.test.tsx`
- Create: `packages/playground/src/lib/ai-ui/tools/badges/__tests__/agent-badge.test.tsx`
- Modify: `packages/playground/src/lib/ai-ui/tools/__tests__/agent-badge-routing-decision.test.tsx`

**Interfaces:**

- Consumes: The `ToolCall` presentation overrides from Task 1.
- Produces: Workflow, agent, Code Mode, and loading rows using the shared shell.

- [ ] Add failing behavioral tests for the workflow name and blue workflow icon, agent ID and green agent icon, Code Mode coin icon and yellow color, and the non-interactive shared loading row.
- [ ] Run the focused Playground tests and confirm they fail because the badges still use `BadgeWrapper`.
- [ ] Replace each `BadgeWrapper` with `ToolCall`, preserving header actions, default open behavior, approval controls, workflow graph, child messages, formatted program, logs, results, and suspend payloads.
- [ ] Update the routing-decision test seam to wrap the real `ToolCall` rather than mocking the removed legacy wrapper.
- [ ] Run the focused tests and confirm they pass.
- [ ] Search production Playground code and confirm no renderer imports `BadgeWrapper`.

### Task 3: Add visual examples

**Files:**

- Modify: `packages/playground-ui/src/ds/components/ai/tool-call/tool-call.stories.tsx`

**Interfaces:**

- Consumes: The `ToolCall` presentation API from Task 1.
- Produces: Storybook examples for a generic tool, workflow, agent, and Code Mode call.

- [ ] Add stories with `ToolsIcon`/yellow, `WorkflowIcon`/blue, `AgentIcon`/green, and `ToolCoinIcon`/yellow.
- [ ] Keep one operation-specific tool story to show that `Read`, `Write`, `Run`, and `Search` icons remain intact.
- [ ] Run the Playground UI build to validate story types and exports.

### Task 4: Verify packages and changesets

**Files:**

- Modify: `.changeset/hungry-onions-shake.md`
- Modify: `.changeset/rare-lemons-cross.md`

**Interfaces:**

- Consumes: Tasks 1 through 3.
- Produces: Release notes describing the complete shared-shell migration and entity icon colors.

- [ ] Update the existing changesets without creating duplicate release entries.
- [ ] Run focused tests for both packages.
- [ ] Run both package typechecks.
- [ ] Run the Playground UI build.
- [ ] Run `git diff --check`.

### Task 5: Exercise every renderer in Chef Model V2

**Files:**

- Modify only if needed and keep uncommitted: `examples/agent/**`

**Interfaces:**

- Consumes: The built UI and running example server.
- Produces: A browser-visible generic tool, workflow, agent, and Code Mode call.

- [ ] Inspect Chef Model V2 tool registration and add only missing test fixtures.
- [ ] Start or restart the API and Playground UI.
- [ ] Open Chef Model V2 in the in-app browser.
- [ ] Trigger one generic/specific tool, one workflow, one sub-agent, and one Code Mode call.
- [ ] Verify the shared row shell, preserved icon, correct entity color, expansion behavior, and custom body for each call.
- [ ] Leave all example-only fixture changes uncommitted.
