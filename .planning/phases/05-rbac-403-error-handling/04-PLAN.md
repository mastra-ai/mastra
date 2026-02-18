# Plan: Update Page Components to Pass Error Props

---
wave: 3
depends_on:
  - 03-PLAN.md
files_modified:
  - packages/playground/src/pages/agents/index.tsx
  - packages/playground/src/pages/workflows/index.tsx
  - packages/playground/src/pages/tools/index.tsx
  - packages/playground/src/pages/mcps/index.tsx
autonomous: true
---

## Goal

Update playground page components to pass `error` prop from hooks to table components.

## Context

The table components now accept an `error` prop to render `PermissionDenied`.
Page components need to destructure `error` from hooks and pass it through.

Per `packages/playground/CLAUDE.md`: This package is composition only - we're just wiring the prop through.

## Tasks

<task id="1">
Update `packages/playground/src/pages/agents/index.tsx`:

Destructure `error` from `useAgents()` and pass to `AgentsTable`:

```typescript
// Change this line:
const { data: agents = {}, isLoading } = useAgents();

// To:
const { data: agents = {}, isLoading, error } = useAgents();

// And pass error to AgentsTable:
<AgentsTable
  agents={agents}
  isLoading={isLoading}
  error={error}
  onCreateClick={experimentalFeaturesEnabled ? () => setIsCreateDialogOpen(true) : undefined}
/>
```
</task>

<task id="2">
Update `packages/playground/src/pages/workflows/index.tsx`:

Destructure `error` from workflows hook and pass to table.
</task>

<task id="3">
Update `packages/playground/src/pages/tools/index.tsx`:

Destructure `error` from tools hook and pass to table.
</task>

<task id="4">
Update `packages/playground/src/pages/mcps/index.tsx`:

Destructure `error` from MCP servers hook and pass to table.
</task>

## Verification

```bash
# Build both packages
cd /Users/yj/.superset/worktrees/mastra/auth-exploration
pnpm build:packages

# TypeScript check
pnpm typecheck
```

## must_haves

- [ ] Agents page passes error to AgentsTable
- [ ] Workflows page passes error to WorkflowsTable
- [ ] Tools page passes error to ToolsTable
- [ ] MCPs page passes error to MCPTable
- [ ] All pages compile without TypeScript errors
