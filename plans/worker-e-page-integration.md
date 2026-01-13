# Worker E: Page Integration

> **Role**: Integrating components into existing pages  
> **Priority**: MEDIUM - Final assembly work  
> **Status**: BLOCKED (waiting on Worker B dialogs)

---

## Overview

Worker E integrates all the components built by Workers B and D into the existing pages. This includes updating the agents table, agents list page, and agent header.

---

## Dependencies

- **Worker A (Task 1)**: ✅ COMPLETE - `source` field available
- **Worker B (Tasks 8-10)**: 🔲 WAITING - Need dialogs (Create, Edit, Delete) for integration
- **Worker D (V13, V14)**: Coordinate on header/information panel changes

---

## Tasks

### Task 11: Update Agents Table with Source Badge

**Priority**: HIGH  
**Depends on**: Worker A (Task 1)

**Goal**: Visual indicator for stored agents in the agents table.

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/types.ts`

**Add source to type**:

```typescript
export interface AgentTableData {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  modelId?: string;
  tools?: string[];
  source?: 'code' | 'stored'; // ADD THIS
}
```

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/columns.tsx`

**Add source badge to name column**:

```typescript
import { Database } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// In the name column cell renderer:
{
  accessorKey: 'name',
  header: 'Name',
  cell: ({ row }) => {
    const isStored = row.original.source === 'stored';
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {isStored && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Database className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Stored agent - can be edited
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  },
}
```

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx`

**Ensure source is passed through**:

```typescript
// When mapping agents to table data, include source:
const tableData = Object.entries(agents).map(([id, agent]) => ({
  id,
  name: agent.name,
  description: agent.description,
  provider: agent.provider,
  modelId: agent.modelId,
  tools: Object.keys(agent.tools || {}),
  source: agent.source, // ADD THIS
}));
```

---

### Task 12: Update Empty State with Create CTA

**Priority**: HIGH  
**Depends on**: Worker B (Task 8)

**Goal**: Add "Create your first agent" button to empty state.

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx`

**Update AgentsTable props**:

```typescript
interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  onCreateClick?: () => void; // ADD THIS
}
```

**Update EmptyAgentsTable**:

```typescript
import { Plus, BookOpen } from 'lucide-react';
import { Button } from '@/ds/components/Button';

interface EmptyAgentsTableProps {
  onCreateClick?: () => void;
}

const EmptyAgentsTable = ({ onCreateClick }: EmptyAgentsTableProps) => (
  <EmptyState
    iconSlot={<AgentCoinIcon className="w-12 h-12 text-muted-foreground" />}
    titleSlot="No Agents Yet"
    descriptionSlot="Create your first agent or configure agents in code."
    actionSlot={
      <div className="flex flex-col sm:flex-row gap-2">
        {onCreateClick && (
          <Button size="lg" onClick={onCreateClick}>
            <Plus className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          as="a"
          href="https://mastra.ai/docs/agents"
          target="_blank"
          rel="noopener noreferrer"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Documentation
        </Button>
      </div>
    }
  />
);
```

**Pass onCreateClick through**:

```typescript
export function AgentsTable({ agents, isLoading, onCreateClick }: AgentsTableProps) {
  // ... existing code

  if (!isLoading && Object.keys(agents).length === 0) {
    return <EmptyAgentsTable onCreateClick={onCreateClick} />;
  }

  // ... rest of component
}
```

---

### Task 13: Update Agents Page with Create Button

**Priority**: HIGH  
**Depends on**: Worker B (Task 8)

**Goal**: Add "Create Agent" button in header and wire up dialog.

**File**: `packages/playground/src/pages/agents/index.tsx`

**Full implementation**:

```typescript
import { useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import {
  AgentsTable,
  CreateAgentDialog,
  useAgents,
} from '@mastra/playground-ui';
import { useLinkComponent } from '@/lib/framework';
import { Button } from '@mastra/playground-ui/ds/components/Button';
import {
  MainContentLayout,
  Header,
  HeaderTitle,
  HeaderAction,
  MainContentContent,
  Icon,
} from '@mastra/playground-ui/components/ui/elements';
import { AgentIcon } from '@mastra/playground-ui/ds/icons';

function Agents() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: agents, isLoading } = useAgents();
  const { navigate, paths, Link } = useLinkComponent();

  const handleAgentCreated = (agentId: string) => {
    setIsCreateDialogOpen(false);
    // Navigate to the new agent's chat page
    navigate(`${paths.agentLink(agentId)}/chat`);
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </HeaderTitle>
        <HeaderAction>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Agent
          </Button>
          <Button
            variant="outline"
            as={Link}
            to="https://mastra.ai/docs/agents"
            target="_blank"
          >
            <Icon>
              <BookOpen />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <AgentsTable
          agents={agents || {}}
          isLoading={isLoading}
          onCreateClick={() => setIsCreateDialogOpen(true)}
        />
      </MainContentContent>

      <CreateAgentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleAgentCreated}
      />
    </MainContentLayout>
  );
}

export default Agents;
```

---

### Task 14: Add Edit Button to Agent Header

**Priority**: HIGH  
**Depends on**: Worker B (Tasks 9, 10), Worker A (Task 1)

**Goal**: Edit button for stored agents in detail page header.

**File**: `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`

**Note**: Coordinate with Worker D who is also modifying this file for version badge.

**Full implementation**:

```typescript
import { useState } from 'react';
import { EntityHeader } from '@/components/ui/entity-header';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CopyIcon, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useToast } from '@/hooks/use-toast';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useAgent } from '../hooks/use-agent';
import { EditAgentDialog } from './create-agent/edit-agent-dialog';
import { useLinkComponent } from '@/lib/framework';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const { toast } = useToast();
  const { navigate, paths } = useLinkComponent();

  const agentName = agent?.name || '';
  const isStoredAgent = agent?.source === 'stored';

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    toast({
      title: 'Agent updated',
      description: 'Your changes have been saved.',
    });
  };

  const handleDelete = () => {
    setIsEditDialogOpen(false);
    toast({
      title: 'Agent deleted',
      description: 'The agent has been removed.',
    });
    navigate(paths.agentsLink);
  };

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        {/* Agent ID badge with copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleCopy} className="h-badge-default shrink-0">
              <Badge icon={<CopyIcon />} variant="default">
                {agentId}
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy Agent ID for use in code</TooltipContent>
        </Tooltip>

        {/* Edit button - only for stored agents */}
        {isStoredAgent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </EntityHeader>

      {/* Edit dialog - only render for stored agents */}
      {isStoredAgent && (
        <EditAgentDialog
          agentId={agentId}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          onDelete={handleDelete}
        />
      )}
    </TooltipProvider>
  );
};
```

---

### Task 15: Export New Components

**Priority**: LOW (Final step)  
**Depends on**: All other tasks

**Goal**: Make all new components available for import.

**File**: `packages/playground-ui/src/domains/agents/components/create-agent/index.tsx` (Worker B creates this)

Verify exports:

```typescript
export { CreateAgentDialog } from './create-agent-dialog';
export { EditAgentDialog } from './edit-agent-dialog';
export { AgentForm } from './agent-form';
export { ModelPicker } from './model-picker';
export { MultiSelectPicker } from './multi-select-picker';
export { DeleteAgentConfirm } from './delete-agent-confirm';
export { agentFormSchema, type AgentFormValues } from './form-validation';
```

**File**: `packages/playground-ui/src/domains/agents/index.tsx`

Add exports:

```typescript
// Existing exports
export * from './components/agent-table';
export * from './components/agent-information';
export * from './components/agent-entity-header';
// ... other existing exports

// NEW exports for create-agent
export * from './components/create-agent';
export * from './hooks/use-stored-agents';

// NEW exports for agent-versions (Worker D)
export * from './components/agent-versions';
export * from './hooks/use-agent-versions';
```

**File**: `packages/playground-ui/src/domains/memory/index.tsx`

Add export:

```typescript
// Existing exports
export * from './hooks/use-memory';

// NEW export
export { useMemoryConfigs } from './hooks/use-memory-configs';
```

**File**: `packages/playground-ui/src/index.tsx` (main barrel)

Verify domains are exported:

```typescript
export * from './domains/agents';
export * from './domains/memory';
// ... other exports
```

---

## File Ownership

Worker E owns exclusively:

- `packages/playground/src/pages/agents/index.tsx`

Worker E modifies (shared ownership):

- `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx`
- `packages/playground-ui/src/domains/agents/components/agent-table/columns.tsx`
- `packages/playground-ui/src/domains/agents/components/agent-table/types.ts`
- `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx` (coordinate with Worker D)
- `packages/playground-ui/src/domains/agents/index.tsx`
- `packages/playground-ui/src/domains/memory/index.tsx`

---

## Coordination Notes

### With Worker B

- Worker B builds the dialogs (Tasks 8-10)
- Worker E imports and uses them
- Wait for Worker B to complete before Tasks 13, 14

### With Worker D

- Both modify `agent-entity-header.tsx`
- Worker E adds: Edit button
- Worker D adds: Version badge
- **Solution**: Worker E does basic edit button first, Worker D adds version badge alongside

### With Worker A

- Worker A adds `source` field to schema
- Worker E uses it for conditional rendering
- Wait for Task 1 before Tasks 11, 14

---

## Testing Checklist

- [ ] Database icon shows next to stored agents in table
- [ ] Tooltip shows "Stored agent - can be edited" on hover
- [ ] Empty state shows "Create Agent" button
- [ ] Empty state shows "Documentation" link
- [ ] Clicking "Create Agent" opens dialog
- [ ] Creating agent navigates to `/agents/{id}/chat`
- [ ] "Create Agent" button appears in header
- [ ] "Edit" button appears for stored agents in detail header
- [ ] "Edit" button does NOT appear for code-defined agents
- [ ] Edit dialog opens with pre-filled values
- [ ] Saving edit shows success toast
- [ ] Deleting agent navigates back to `/agents`
- [ ] All exports work (can import from `@mastra/playground-ui`)
