# Plan: Integrate 403 Handling in Domain Hooks and Tables

---
wave: 2
depends_on:
  - 01-PLAN.md
  - 02-PLAN.md
files_modified:
  - packages/playground-ui/src/domains/agents/hooks/use-agents.ts
  - packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx
  - packages/playground-ui/src/domains/workflows/hooks/use-workflows.ts
  - packages/playground-ui/src/domains/workflows/components/workflow-table/workflow-table.tsx
  - packages/playground-ui/src/domains/tools/hooks/use-all-tools.ts
  - packages/playground-ui/src/domains/tools/components/tool-table/tool-table.tsx
  - packages/playground-ui/src/domains/mcps/hooks/use-mcp-servers.ts
  - packages/playground-ui/src/domains/mcps/components/mcp-table/mcp-table.tsx
autonomous: true
---

## Goal

Update domain hooks to return error state and table components to render `PermissionDenied` on 403.

## Context

Currently, tables receive only `data` and `isLoading` from hooks. When a 403 occurs:
1. `data` is undefined
2. `isLoading` becomes false
3. Table renders "empty state" instead of permission error

We need to:
1. Return `error` from hooks
2. Check for 403 BEFORE empty state in tables

## Tasks

<task id="1">
Update `packages/playground-ui/src/domains/agents/hooks/use-agents.ts`:

Return the full query result so consumers can access error:

```typescript
import { usePlaygroundStore } from '@/store/playground-store';
import { ReorderModelListParams, UpdateModelInModelListParams, UpdateModelParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useAgents = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agents', requestContext],
    queryFn: () => client.listAgents(requestContext),
  });
};

// ... rest of file unchanged
```

Note: The hook already returns the full query result. No change needed here - consumers just need to destructure `error` and `isError`.
</task>

<task id="2">
Update `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx`:

Add error prop and 403 handling:

```typescript
// Add imports at top
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';

// Update props interface
export interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
}

// Update component signature
export function AgentsTable({ agents, isLoading, error, onCreateClick }: AgentsTableProps) {
  // ... existing state and hooks

  // Add 403 check BEFORE empty state check
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (projectData.length === 0 && !isLoading) {
    return <EmptyAgentsTable onCreateClick={onCreateClick} />;
  }

  // ... rest unchanged
}
```
</task>

<task id="3">
Update `packages/playground-ui/src/domains/workflows/components/workflow-table/workflow-table.tsx`:

Add error prop and 403 handling (same pattern as agents):

```typescript
// Add imports
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';

// Update props interface
export interface WorkflowsTableProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  error?: Error | null;
}

// Add 403 check before empty state in component body
if (error && is403ForbiddenError(error)) {
  return (
    <div className="flex h-full items-center justify-center">
      <PermissionDenied resource="workflows" />
    </div>
  );
}
```
</task>

<task id="4">
Update `packages/playground-ui/src/domains/tools/components/tool-table/tool-table.tsx`:

Add error prop and 403 handling (same pattern):

```typescript
// Add imports
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';

// Update props interface to include error
// Add 403 check before empty state
```
</task>

<task id="5">
Update `packages/playground-ui/src/domains/mcps/components/mcp-table/mcp-table.tsx`:

Add error prop and 403 handling (same pattern):

```typescript
// Add imports
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';

// Update props interface to include error
// Add 403 check before empty state
```
</task>

## Verification

```bash
# TypeScript compiles
cd packages/playground-ui && pnpm build

# Run tests
pnpm test
```

## must_haves

- [ ] AgentsTable renders PermissionDenied on 403 error
- [ ] WorkflowsTable renders PermissionDenied on 403 error
- [ ] ToolsTable renders PermissionDenied on 403 error
- [ ] MCPTable renders PermissionDenied on 403 error
- [ ] 403 check happens BEFORE empty state check
- [ ] Empty state still works when error is null/undefined
