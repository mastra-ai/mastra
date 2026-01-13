# AgentCMS - Implementation Plan (Phase 1)

> **Status**: IN PROGRESS  
> **Created**: January 2025  
> **Updated**: January 12, 2025  
> **Feature**: Full CRUD for Agents from Mastra Studio UI

---

## Progress Summary

### ✅ Completed Tasks - Phase 1A Foundation

| Task        | Description                                        | PR/Commit |
| ----------- | -------------------------------------------------- | --------- |
| **Task 1**  | Add `source` field to Agent schema & response      | PR #11848 |
| **Task 1+** | Add `ownerId` field for multi-tenant filtering     | PR #11848 |
| **Task 1+** | Add schema migration for `ownerId` column          | PR #11848 |
| **Task 2**  | Create stored agent hooks (`use-stored-agents.ts`) | PR #11847 |
| **Task 2+** | Update client SDK stored-agent methods             | PR #11847 |
| **Task 4**  | Create Multi-Select Picker component               | PR #11850 |
| **Task 5**  | Create Form Validation schema                      | PR #11851 |
| **Task 3**  | Create Model Picker component                      | PR #11852 |
| **Task 6**  | Create Agent Form component                        | PR #11857 |
| **Task 8**  | Create Agent Dialog                                | PR #11860 |
| **Task 9**  | Edit Agent Dialog                                  | PR #11859 |
| **Task 10** | Delete Agent Confirmation                          | PR #11859 |

### ✅ Completed Tasks - Phase 1B Versioning Foundation

| Task        | Description                                       | PR/Commit |
| ----------- | ------------------------------------------------- | --------- |
| **V1**      | Add `TABLE_AGENT_VERSIONS` schema constant        | PR #11849 |
| **V6**      | Add `activeVersionId` to agents schema            | PR #11849 |
| **V6+**     | Add schema migration for `activeVersionId` column | PR #11849 |
| **V2**      | Create `AgentVersionsStorage` base class          | PR #11858 |
| **V3**      | Create in-memory implementation                   | PR #11858 |
| **V4**      | Create PostgreSQL implementation                  | PR #11858 |
| **V5**      | Add version server routes & handlers              | PR #11863 |
| **Task 11** | Update Agents Table with source badge             | PR #11864 |
| **Task 12** | Update Empty State with Create CTA                | PR #11864 |
| **Task 13** | Update Agents page with create button             | PR #11864 |
| **Task 14** | Add Edit button to Agent Header                   | PR #11864 |
| **Task 15** | Export new components                             | PR #11864 |

### ✅ Completed Tasks - Phase 1A + 1B Backend

| Task       | Description                                    | PR/Commit |
| ---------- | ---------------------------------------------- | --------- |
| **Task 7** | Add Memory Configs API endpoint                | PR #11865 |
| **V7**     | Update `getStoredAgent` for version resolution | PR #11866 |
| **V8**     | Add version methods to client SDK              | PR #11866 |
| **V9**     | Create `useAgentVersions` hooks                | PR #11867 |
| **V10**    | Create `AgentVersions` list component          | PR #11868 |
| **V11**    | Create `SaveVersionDialog` component           | PR #11868 |
| **V12**    | Create `VersionCompareDialog` with diff view   | PR #11869 |

### 🔲 Remaining Tasks - Phase 1B Versioning UI

| Task    | Description                              | Status |
| ------- | ---------------------------------------- | ------ |
| **V13** | Add "Versions" tab to `AgentInformation` | TODO   |
| **V14** | Add version badge to `AgentEntityHeader` | TODO   |
| **V15** | Implement retention enforcement          | TODO   |

---

## Progress Summary

### Completed Tasks

| Task        | Description                                    | Status  | PR/Commit              |
| ----------- | ---------------------------------------------- | ------- | ---------------------- |
| **Task 1**  | Add `source` field to Agent schema & response  | ✅ DONE | PR #11848              |
| **Task 1+** | Add `ownerId` field for multi-tenant filtering | ✅ DONE | PR #11848              |
| **Task 1+** | Add schema migration for `ownerId` column      | ✅ DONE | PR #11848              |
| **Task 2**  | Create stored agent hooks                      | ✅ DONE | `use-stored-agents.ts` |
| **Task 2+** | Update client SDK stored-agent methods         | ✅ DONE | `stored-agent.ts`      |

### In Progress Tasks

| Task        | Description                           | Status  | Assignee |
| ----------- | ------------------------------------- | ------- | -------- |
| **Task 3**  | Create Model Picker component         | 🔲 TODO | Worker B |
| **Task 4**  | Create Multi-Select Picker component  | 🔲 TODO | Worker B |
| **Task 5**  | Create Form Validation schema         | 🔲 TODO | Worker B |
| **Task 6**  | Create Agent Form component           | 🔲 TODO | Worker B |
| **Task 7**  | Add Memory Configs API endpoint       | 🔲 TODO | Worker A |
| **Task 8**  | Create Agent Dialog                   | 🔲 TODO | Worker B |
| **Task 9**  | Edit Agent Dialog                     | 🔲 TODO | Worker B |
| **Task 10** | Delete Agent Confirmation             | 🔲 TODO | Worker B |
| **Task 11** | Update Agents Table with source badge | 🔲 TODO | Worker E |
| **Task 12** | Update Empty State with Create CTA    | 🔲 TODO | Worker E |
| **Task 13** | Update Agents page with create button | 🔲 TODO | Worker E |
| **Task 14** | Add Edit button to Agent Header       | 🔲 TODO | Worker E |
| **Task 15** | Export new components                 | 🔲 TODO | Any      |

### Versioning Tasks (Phase 1B)

All versioning tasks (V1-V15) are pending, blocked on Phase 1A completion.

---

## Overview

**Feature**: Full CRUD for Agents from Mastra Studio UI

- **Create**: Dialog with form to create new stored agents
- **Read**: Visual distinction between stored and code-defined agents
- **Update**: Edit dialog for stored agents (code-defined agents cannot be edited)
- **Delete**: Delete stored agents with confirmation

---

## Final Decisions Summary

| Decision             | Choice                                   |
| -------------------- | ---------------------------------------- |
| ID Generation        | Database UUIDs via `crypto.randomUUID()` |
| Form Mode            | Simple + Advanced toggle                 |
| After Create         | Navigate to `/agents/{id}/chat`          |
| After Edit           | Stay on current page + success toast     |
| After Delete         | Navigate to `/agents` list               |
| Edit Button Location | Agent entity header                      |
| Code-defined Agents  | Hide edit button entirely (not disabled) |
| Provider Warning     | Allow creation with warning              |
| Name Uniqueness      | Names can duplicate; only IDs unique     |
| Empty State          | "Create your first agent" CTA            |
| Memory Picker        | Show registered memory configs           |
| Stored Agent Icon    | Database icon (temporary)                |

---

## Background: Existing Infrastructure

### Server Routes (Already Exist)

| Endpoint                 | Method | Description              |
| ------------------------ | ------ | ------------------------ |
| `/api/stored/agents`     | GET    | List all stored agents   |
| `/api/stored/agents`     | POST   | Create a stored agent    |
| `/api/stored/agents/:id` | GET    | Get a stored agent by ID |
| `/api/stored/agents/:id` | PATCH  | Update a stored agent    |
| `/api/stored/agents/:id` | DELETE | Delete a stored agent    |

### Client SDK (Already Exists)

```typescript
client.listStoredAgents(params);
client.createStoredAgent(params);
client.getStoredAgent(id).details();
client.getStoredAgent(id).update(params);
client.getStoredAgent(id).delete();
```

### Stored Agent Schema

```typescript
interface StorageAgentType {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: Record<string, unknown>; // { provider, name, ...options }
  tools?: string[]; // Tool keys from registry
  workflows?: string[]; // Workflow keys from registry
  agents?: string[]; // Sub-agent keys from registry
  memory?: string; // Memory key from registry
  scorers?: Record<string, ScorerConfig>;
  defaultOptions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Implementation Tasks

### Task 1: Add `source` Field to Agent Schema & Response

**Goal**: Distinguish stored agents from code-defined agents in API responses.

**Files to modify**:

| File                                            | Changes                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `packages/core/src/agent/types.ts`              | Add `source?: 'code' \| 'stored'` to `AgentConfig`          |
| `packages/core/src/mastra/index.ts`             | Set `source: 'stored'` in `#createAgentFromStoredConfig()`  |
| `packages/server/src/server/schemas/agents.ts`  | Add `source` to `serializedAgentSchema`                     |
| `packages/server/src/server/handlers/agents.ts` | Include `source` in `formatAgent()` and `formatAgentList()` |
| `client-sdks/client-js/src/types.ts`            | Add `source?: 'code' \| 'stored'` to `GetAgentResponse`     |

---

### Task 2: Create Stored Agent Hooks

**Goal**: React Query mutations for stored agent CRUD.

**New file**: `packages/playground-ui/src/domains/agents/hooks/use-stored-agents.ts`

```typescript
export const useCreateStoredAgent = () => {
  // POST /api/stored/agents
  // On success: invalidate ['agents'] query
};

export const useUpdateStoredAgent = (agentId: string) => {
  // PATCH /api/stored/agents/:agentId
  // On success: invalidate ['agents'] and ['agent', agentId] queries
};

export const useDeleteStoredAgent = (agentId: string) => {
  // DELETE /api/stored/agents/:agentId
  // On success: invalidate ['agents'] query
};
```

---

### Task 3: Create Model Picker Component

**Goal**: Reusable provider + model selector.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/model-picker.tsx`

**Features**:

- Provider dropdown with connection status (green/red dot)
- Model dropdown filtered by provider
- Warning alert when provider not connected
- Custom model ID support
- Keyboard navigation

**Based on**: Extract logic from `agent-metadata-model-switcher.tsx`

---

### Task 4: Create Multi-Select Picker Component

**Goal**: Generic multi-select for tools, workflows, sub-agents.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/multi-select-picker.tsx`

**Props**:

```typescript
interface MultiSelectPickerProps<T> {
  label: string;
  options: T[];
  selected: string[];
  onChange: (selected: string[]) => void;
  getOptionId: (option: T) => string;
  getOptionLabel: (option: T) => string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  singleSelect?: boolean; // For memory picker
}
```

**Features**:

- Search/filter input
- Checkbox selection (or radio for single-select)
- Selected items shown as badges
- Remove badge to deselect
- Empty state message

---

### Task 5: Create Form Validation Schema

**Goal**: Zod schema and validation helpers.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/form-validation.ts`

```typescript
export const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  instructions: z.string().min(1, 'Instructions are required'),
  model: z.object({
    provider: z.string().min(1, 'Provider is required'),
    name: z.string().min(1, 'Model is required'),
  }),
  tools: z.array(z.string()).optional(),
  workflows: z.array(z.string()).optional(),
  agents: z.array(z.string()).optional(),
  memory: z.string().optional(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

// Validation helpers
export function validateReferences(
  values: AgentFormValues,
  availableTools: string[],
  availableWorkflows: string[],
  availableAgents: string[],
): ValidationResult;

export function isProviderConnected(provider: string, providers: Provider[]): boolean;
```

---

### Task 6: Create Agent Form Component

**Goal**: Shared form for create and edit modes.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/agent-form.tsx`

**Props**:

```typescript
interface AgentFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void; // Only for edit mode
  isSubmitting?: boolean;
  isDeleting?: boolean;
  excludeAgentId?: string; // Exclude from sub-agents picker
}
```

**Form Layout**:

```
+-------------------------------------------------------------+
|  [Simple Mode - Always Visible]                             |
|                                                             |
|  Name *                    [ID badge - edit mode only]      |
|  +-------------------------------------------------------+  |
|  |                                                       |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  Description                                                |
|  +-------------------------------------------------------+  |
|  |                                                       |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  Model *                                                    |
|  [ModelPicker Component]                                    |
|                                                             |
|  System Instructions *                                      |
|  +-------------------------------------------------------+  |
|  |                                                       |  |
|  |                                                       |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  > Advanced Options [Collapsible]                           |
|  +-------------------------------------------------------+  |
|  | Tools         [MultiSelectPicker]                     |  |
|  | Workflows     [MultiSelectPicker]                     |  |
|  | Sub-Agents    [MultiSelectPicker]                     |  |
|  | Memory        [SingleSelectPicker]                    |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +-------------------------------------------------------+  |
|  | [Delete - edit only]      [Cancel] [Submit]           |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

**State Management**: React Hook Form + Zod resolver

---

### Task 7: Add Memory Configs API Endpoint & Hook

**Goal**: Expose registered memory configurations for the picker.

**Server Route** (new):

**File**: `packages/server/src/server/handlers/memory.ts`

```typescript
// GET /api/memory/configs
// Returns: { configs: [{ id: string, name?: string }] }
export const LIST_MEMORY_CONFIGS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/memory/configs',
  handler: async ({ mastra }) => {
    const memoryRegistry = mastra.listMemory();
    const configs = Object.entries(memoryRegistry || {}).map(([key, memory]) => ({
      id: key,
      name: memory.id || key,
    }));
    return { configs };
  },
});
```

**Route Registration**: `packages/server/src/server/server-adapter/routes/memory.ts`

**Client SDK**:

**File**: `client-sdks/client-js/src/client.ts`

```typescript
public async listMemoryConfigs(): Promise<{ configs: MemoryConfig[] }> {
  return this.request('/api/memory/configs');
}
```

**File**: `client-sdks/client-js/src/types.ts`

```typescript
export interface MemoryConfig {
  id: string;
  name?: string;
}
```

**Hook**:

**New file**: `packages/playground-ui/src/domains/memory/hooks/use-memory-configs.ts`

```typescript
export const useMemoryConfigs = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['memory', 'configs'],
    queryFn: () => client.listMemoryConfigs(),
  });
};
```

---

### Task 8: Create Agent Dialog

**Goal**: Dialog wrapper for creating new agents.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/create-agent-dialog.tsx`

**Props**:

```typescript
interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (agentId: string) => void;
}
```

**Features**:

- Uses Radix Dialog
- Renders `AgentForm` in create mode
- Generates UUID for new agent ID
- Calls `useCreateStoredAgent` mutation
- Shows loading state during submission
- Calls `onSuccess` with new agent ID

---

### Task 9: Edit Agent Dialog

**Goal**: Dialog for editing stored agents.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/edit-agent-dialog.tsx`

**Props**:

```typescript
interface EditAgentDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}
```

**Features**:

- Fetches current agent config via `client.getStoredAgent(agentId).details()`
- Shows loading skeleton while fetching
- Pre-fills form with current values
- Calls `useUpdateStoredAgent` mutation
- Shows success toast on save
- Handles delete flow

---

### Task 10: Delete Agent Confirmation

**Goal**: Confirmation dialog before deleting an agent.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/delete-agent-confirm.tsx`

**Props**:

```typescript
interface DeleteAgentConfirmProps {
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}
```

**UI**:

```
+-------------------------------------------------------------+
|  Delete Agent                                           [X] |
+-------------------------------------------------------------+
|                                                             |
|  Are you sure you want to delete "{agentName}"?             |
|                                                             |
|  This action cannot be undone.                              |
|                                                             |
|                              [Cancel] [Delete - danger]     |
+-------------------------------------------------------------+
```

---

### Task 11: Update Agents Table with Source Badge

**Goal**: Visual indicator for stored agents.

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/columns.tsx`

**Changes**:

- Add database icon next to agent name when `source === 'stored'`
- Tooltip: "Stored agent - can be edited"

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/types.ts`

- Add `source?: 'code' | 'stored'` to `AgentTableData`

---

### Task 12: Update Empty State with Create CTA

**Goal**: Add "Create your first agent" button.

**File**: `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx`

**Changes to `EmptyAgentsTable`**:

```tsx
const EmptyAgentsTable = ({ onCreateClick }: { onCreateClick?: () => void }) => (
  <EmptyState
    iconSlot={<AgentCoinIcon />}
    titleSlot="No Agents Yet"
    descriptionSlot="Create your first agent or configure agents in code."
    actionSlot={
      <div className="flex gap-2 flex-col sm:flex-row">
        {onCreateClick && (
          <Button size="lg" onClick={onCreateClick}>
            <PlusIcon /> Create Agent
          </Button>
        )}
        <Button size="lg" variant="light" as="a" href="..." target="_blank">
          <DocsIcon /> Documentation
        </Button>
      </div>
    }
  />
);
```

**Props update for `AgentsTable`**:

```typescript
interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  onCreateClick?: () => void; // NEW
}
```

---

### Task 13: Update Agents Page with Create Button

**Goal**: Add "Create Agent" button in header and wire up dialogs.

**File**: `packages/playground/src/pages/agents/index.tsx`

**Changes**:

```tsx
function Agents() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();

  const handleAgentCreated = (agentId: string) => {
    setIsCreateDialogOpen(false);
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
              <PlusIcon />
            </Icon>
            Create Agent
          </Button>
          <Button as={Link} to="..." target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <AgentsTable agents={agents} isLoading={isLoading} onCreateClick={() => setIsCreateDialogOpen(true)} />
      </MainContentContent>

      <CreateAgentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleAgentCreated}
      />
    </MainContentLayout>
  );
}
```

---

### Task 14: Add Edit Button to Agent Header

**Goal**: Edit button for stored agents in detail page header.

**File**: `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`

**Changes**:

```tsx
export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { toast } = useToast();

  const isStoredAgent = agent?.source === 'stored';

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    toast({ title: 'Agent updated successfully' });
  };

  const handleDelete = () => {
    navigate(paths.agentsLink);
  };

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        {/* Existing ID badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleCopy}>
              <Badge icon={<CopyIcon />}>{agentId}</Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy Agent ID</TooltipContent>
        </Tooltip>

        {/* Edit button - only for stored agents */}
        {isStoredAgent && (
          <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            <PencilIcon className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </EntityHeader>

      {/* Edit dialog - only for stored agents */}
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

**Goal**: Make new components available for import.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/index.tsx`

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

```typescript
// Add to existing exports
export * from './components/create-agent';
export * from './hooks/use-stored-agents';
```

**File**: `packages/playground-ui/src/domains/memory/index.tsx`

```typescript
// Add to existing exports
export { useMemoryConfigs } from './hooks/use-memory-configs';
```

---

## Complete File Structure

```
packages/playground-ui/src/
├── domains/
│   ├── agents/
│   │   ├── components/
│   │   │   ├── create-agent/
│   │   │   │   ├── index.tsx                 # NEW
│   │   │   │   ├── create-agent-dialog.tsx   # NEW
│   │   │   │   ├── edit-agent-dialog.tsx     # NEW
│   │   │   │   ├── agent-form.tsx            # NEW
│   │   │   │   ├── model-picker.tsx          # NEW
│   │   │   │   ├── multi-select-picker.tsx   # NEW
│   │   │   │   ├── delete-agent-confirm.tsx  # NEW
│   │   │   │   └── form-validation.ts        # NEW
│   │   │   ├── agent-table/
│   │   │   │   ├── agent-table.tsx           # MODIFIED
│   │   │   │   ├── columns.tsx               # MODIFIED
│   │   │   │   └── types.ts                  # MODIFIED
│   │   │   ├── agent-entity-header.tsx       # MODIFIED
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── use-agents.ts                 # EXISTING
│   │   │   ├── use-stored-agents.ts          # NEW
│   │   │   └── ...
│   │   └── index.tsx                         # MODIFIED
│   └── memory/
│       ├── hooks/
│       │   ├── use-memory.ts                 # EXISTING
│       │   └── use-memory-configs.ts         # NEW
│       └── index.tsx                         # MODIFIED

packages/playground/src/pages/agents/
└── index.tsx                                 # MODIFIED

packages/server/src/server/
├── schemas/
│   └── agents.ts                             # MODIFIED
├── handlers/
│   ├── agents.ts                             # MODIFIED
│   └── memory.ts                             # MODIFIED
└── server-adapter/routes/
    └── memory.ts                             # MODIFIED

packages/core/src/
├── agent/
│   └── types.ts (or agent.ts)                # MODIFIED
└── mastra/
    └── index.ts                              # MODIFIED

client-sdks/client-js/src/
├── client.ts                                 # MODIFIED
└── types.ts                                  # MODIFIED
```

---

## Task Summary Table

| #   | Task                                  | Files      | Complexity |
| --- | ------------------------------------- | ---------- | ---------- |
| 1   | Add `source` field to schema/response | 5 files    | Low        |
| 2   | Create stored agent hooks             | 1 new file | Low        |
| 3   | Create Model Picker component         | 1 new file | Medium     |
| 4   | Create Multi-Select Picker component  | 1 new file | Medium     |
| 5   | Create Form Validation schema         | 1 new file | Low        |
| 6   | Create Agent Form component           | 1 new file | High       |
| 7   | Add Memory Configs API + hook         | 4 files    | Medium     |
| 8   | Create Agent Dialog                   | 1 new file | Low        |
| 9   | Edit Agent Dialog                     | 1 new file | Medium     |
| 10  | Delete Agent Confirmation             | 1 new file | Low        |
| 11  | Update table with source badge        | 2 files    | Low        |
| 12  | Update empty state with CTA           | 1 file     | Low        |
| 13  | Update Agents page with create button | 1 file     | Medium     |
| 14  | Add Edit button to Agent Header       | 1 file     | Medium     |
| 15  | Export new components                 | 3 files    | Low        |

**Total**: 15 tasks, ~24 files (8 new, 16 modified)

---

## User Flows

### Create Agent Flow

```
Agents List Page
    | Click "Create Agent"
    v
Create Agent Dialog Opens
    | Fill form (simple mode: name, description, model, instructions)
    | Optionally expand Advanced (tools, workflows, agents, memory)
    | Click "Create Agent"
    v
Validation runs
    | Success
    v
Agent created, dialog closes
    |
    v
Navigate to /agents/{newId}/chat
```

### Edit Agent Flow

```
Agent Detail Page (stored agent)
    | Click "Edit" button in header
    v
Edit Agent Dialog Opens (pre-filled with current config)
    | Modify fields
    | Click "Save Changes"
    v
Validation runs
    | Success
    v
Agent updated, dialog closes, queries invalidated
    | Success toast shown
    v
Stay on current page (refreshed data)
```

### Delete Agent Flow

```
Edit Agent Dialog
    | Click "Delete Agent" (danger button)
    v
Confirmation Dialog Opens
    | Click "Delete" to confirm
    v
Agent deleted
    |
    v
Navigate to /agents (list page)
```

---

# Agent Versioning - Implementation Plan

> **Status**: Ready for Implementation  
> **Feature**: Version history for stored agents with explicit save, side-by-side diff, and active version concept

---

## Versioning Decisions Summary

| Decision        | Choice                                                  |
| --------------- | ------------------------------------------------------- |
| Version Trigger | Manual "Save as Version" action                         |
| Version ID      | ULID (sortable) with optional user-provided vanity name |
| Active Version  | Yes - one version is "active" at runtime                |
| History Model   | Linear (restore creates new version at head)            |
| Diff View       | Side-by-side comparison with field highlighting         |
| Storage         | Full snapshots + change summary                         |
| UI Location     | Tab in AgentInformation panel (stored agents only)      |
| Retention       | Configurable with default N (e.g., 50 versions)         |

---

## Data Model

### New Table: `mastra_agent_versions`

```typescript
const AGENT_VERSIONS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', primaryKey: true }, // ULID - sortable unique ID
  agentId: { type: 'text', nullable: false }, // FK to mastra_agents.id
  versionNumber: { type: 'integer', nullable: false }, // Sequential: 1, 2, 3...
  name: { type: 'text', nullable: true }, // Optional vanity name: "Production v1"
  snapshot: { type: 'jsonb', nullable: false }, // Full StorageAgentType at this version
  changedFields: { type: 'jsonb', nullable: true }, // ["instructions", "model.name"]
  changeMessage: { type: 'text', nullable: true }, // Optional commit-style message
  createdAt: { type: 'timestamp', nullable: false },
};
```

### Modified Table: `mastra_agents`

Add new column:

```typescript
activeVersionId: { type: 'text', nullable: true },  // FK to mastra_agent_versions.id
```

When `activeVersionId` is null, the agent uses its current stored config directly (backwards compatible). When set, the agent resolves from that version's snapshot.

### Types

```typescript
interface AgentVersion {
  id: string; // ULID
  agentId: string;
  versionNumber: number;
  name?: string; // Vanity name
  snapshot: StorageAgentType; // Full config snapshot
  changedFields?: string[]; // Dot-notation paths that changed
  changeMessage?: string; // Optional description
  createdAt: Date;
}

interface AgentVersionDiff {
  field: string; // e.g., "instructions" or "model.provider"
  previousValue: unknown;
  currentValue: unknown;
}

interface CreateVersionInput {
  agentId: string;
  name?: string; // Optional vanity name
  changeMessage?: string; // Optional description
}

interface ListVersionsInput {
  agentId: string;
  page?: number;
  perPage?: number; // Default: 20
}

interface ListVersionsOutput {
  versions: AgentVersion[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
```

---

## API Endpoints

### New Routes

| Endpoint                                                   | Method | Description                                   |
| ---------------------------------------------------------- | ------ | --------------------------------------------- |
| `/api/stored/agents/:agentId/versions`                     | GET    | List versions for an agent                    |
| `/api/stored/agents/:agentId/versions`                     | POST   | Create a new version (snapshot current state) |
| `/api/stored/agents/:agentId/versions/:versionId`          | GET    | Get a specific version                        |
| `/api/stored/agents/:agentId/versions/:versionId/activate` | POST   | Set as active version                         |
| `/api/stored/agents/:agentId/versions/:versionId/restore`  | POST   | Restore to this version (creates new version) |
| `/api/stored/agents/:agentId/versions/:versionId`          | DELETE | Delete a specific version                     |
| `/api/stored/agents/:agentId/versions/compare`             | GET    | Compare two versions (`?from=id1&to=id2`)     |

### Modified Routes

| Endpoint                          | Changes                                             |
| --------------------------------- | --------------------------------------------------- |
| `GET /api/stored/agents/:agentId` | Add `activeVersion` and `latestVersion` to response |
| `GET /api/agents/:agentId`        | Resolve from active version if set                  |

---

## Core Logic

### Creating a Version

```typescript
async function createVersion(input: CreateVersionInput): Promise<AgentVersion> {
  const agent = await agentsStore.getAgentById({ id: input.agentId });

  // Get previous version to calculate changed fields
  const previousVersion = await versionsStore.getLatestVersion(input.agentId);
  const changedFields = previousVersion ? calculateChangedFields(previousVersion.snapshot, agent) : null; // First version has no diff

  // Get next version number
  const versionNumber = (previousVersion?.versionNumber ?? 0) + 1;

  const version: AgentVersion = {
    id: generateULID(),
    agentId: input.agentId,
    versionNumber,
    name: input.name,
    snapshot: agent, // Full current config
    changedFields,
    changeMessage: input.changeMessage,
    createdAt: new Date(),
  };

  await versionsStore.createVersion(version);

  // Optionally set as active if this is the first version
  if (versionNumber === 1) {
    await agentsStore.updateAgent({
      id: input.agentId,
      activeVersionId: version.id,
    });
  }

  // Enforce retention limit
  await enforceRetentionLimit(input.agentId);

  return version;
}
```

### Restoring a Version

```typescript
async function restoreVersion(agentId: string, versionId: string): Promise<AgentVersion> {
  const targetVersion = await versionsStore.getVersion(versionId);

  // Update the agent with the snapshot's config
  await agentsStore.updateAgent({
    id: agentId,
    ...targetVersion.snapshot, // Spread all fields from snapshot
  });

  // Create a NEW version at the head (linear history)
  const newVersion = await createVersion({
    agentId,
    name: `Restored from v${targetVersion.versionNumber}`,
    changeMessage: `Restored from version ${targetVersion.versionNumber}${targetVersion.name ? ` (${targetVersion.name})` : ''}`,
  });

  // Set new version as active
  await agentsStore.updateAgent({
    id: agentId,
    activeVersionId: newVersion.id,
  });

  return newVersion;
}
```

### Activating a Version

```typescript
async function activateVersion(agentId: string, versionId: string): Promise<void> {
  const version = await versionsStore.getVersion(versionId);

  // Update agent's current config to match the version snapshot
  await agentsStore.updateAgent({
    id: agentId,
    ...version.snapshot,
    activeVersionId: versionId,
  });
}
```

### Calculating Changed Fields

```typescript
function calculateChangedFields(previous: StorageAgentType, current: StorageAgentType): string[] {
  const changes: string[] = [];

  const fieldsToCompare = [
    'name',
    'description',
    'instructions',
    'model',
    'tools',
    'workflows',
    'agents',
    'memory',
    'scorers',
    'defaultOptions',
    'metadata',
  ];

  for (const field of fieldsToCompare) {
    if (!deepEqual(previous[field], current[field])) {
      changes.push(field);
    }
  }

  return changes;
}
```

### Retention Management

```typescript
interface AgentVersioningConfig {
  enabled: boolean;
  maxVersionsPerAgent: number; // Default: 50
}

async function enforceRetentionLimit(agentId: string): Promise<void> {
  const config = getVersioningConfig();
  const maxVersions = config.maxVersionsPerAgent;

  const { total } = await versionsStore.listVersions({ agentId, perPage: 1 });

  if (total > maxVersions) {
    // Delete oldest versions, but NEVER delete the active version
    const activeVersionId = await agentsStore.getActiveVersionId(agentId);
    const toDelete = total - maxVersions;

    const oldestVersions = await versionsStore.listVersions({
      agentId,
      perPage: toDelete,
      orderBy: { field: 'versionNumber', direction: 'ASC' },
    });

    for (const version of oldestVersions.versions) {
      if (version.id !== activeVersionId) {
        await versionsStore.deleteVersion(version.id);
      }
    }
  }
}
```

---

## Resolving Agent at Specific Version

Once versioning is implemented, users can retrieve an agent at any version:

```typescript
// Resolve agent at specific version ID
const agent = await mastra.getStoredAgent(agentId, {
  versionId: 'specific-version-id',
});

// Or by version number
const agent = await mastra.getStoredAgent(agentId, {
  versionNumber: 3,
});
```

This enables any downstream use case: evals, A/B testing, comparisons, etc.

---

## UI Components

### New Tab: "Versions" in AgentInformation

Only shown for stored agents (`source === 'stored'`).

```tsx
// In agent-information.tsx
{
  isStoredAgent && <Tab value="versions">Versions</Tab>;
}

{
  isStoredAgent && (
    <TabContent value="versions">
      <AgentVersions agentId={agentId} />
    </TabContent>
  );
}
```

### AgentVersions Component Layout

```
+---------------------------------------------------------------+
| Versions                               [Save as Version]       |
+---------------------------------------------------------------+
|                                                                |
| * v5 (active)                              Jan 3, 2025 2:30 PM |
|   "Production ready"                                           |
|   Changed: instructions, model              [Compare] [...]    |
|                                                                |
| o v4                                       Jan 3, 2025 1:15 PM |
|   "Added search tool"                                          |
|   Changed: tools                            [Compare] [...]    |
|                                                                |
| o v3                                       Jan 2, 2025 4:00 PM |
|                                                                |
| o v2                                       Jan 2, 2025 11:30 AM|
|                                                                |
| o v1                                       Jan 1, 2025 9:00 AM |
|   "Initial version"                                            |
|                                                                |
+---------------------------------------------------------------+
```

### Version Actions Menu ([...])

- **View Details** - Opens version detail dialog
- **Activate** - Sets as active version (if not current)
- **Restore** - Creates new version from this snapshot
- **Delete** - Removes version (with confirmation, cannot delete active)

### Save as Version Dialog

```
+---------------------------------------------------------------+
| Save as Version                                            [X] |
+---------------------------------------------------------------+
|                                                                |
|  Version Name (optional)                                       |
|  +----------------------------------------------------------+  |
|  | e.g., "Production v1" or "Experiment with GPT-4"         |  |
|  +----------------------------------------------------------+  |
|                                                                |
|  Description (optional)                                        |
|  +----------------------------------------------------------+  |
|  | What changed in this version?                             |  |
|  |                                                           |  |
|  +----------------------------------------------------------+  |
|                                                                |
|  Changes from previous version:                                |
|  - instructions (modified)                                     |
|  - model.name (modified)                                       |
|                                                                |
|                               [Cancel] [Save Version]          |
+---------------------------------------------------------------+
```

### Version Compare Dialog (Side-by-Side Diff)

```
+---------------------------------------------------------------+
| Compare Versions                                           [X] |
+---------------------------------------------------------------+
| v3 (Jan 2)                    <->                v5 (Jan 3)   |
+---------------------------------------------------------------+
|                                                                |
| instructions                                                   |
| +-----------------------------+-----------------------------+  |
| | You are a helpful           | You are a helpful           |  |
| | assistant.                  | assistant specialized in    |  |
| |                             | code review.                |  |
| +-----------------------------+-----------------------------+  |
|                                                                |
| model.name                                                     |
| +-----------------------------+-----------------------------+  |
| | gpt-4                       | gpt-4o                      |  |
| +-----------------------------+-----------------------------+  |
|                                                                |
| tools (added)                                                  |
| +-----------------------------+-----------------------------+  |
| | (none)                      | ["searchTool", "calcTool"]  |  |
| +-----------------------------+-----------------------------+  |
|                                                                |
+---------------------------------------------------------------+
```

### Version Badge in Header

For stored agents, show active version indicator in `AgentEntityHeader`:

```tsx
<Badge variant="outline">
  v{activeVersion.versionNumber}
  {activeVersion.name && ` - ${activeVersion.name}`}
</Badge>
```

---

## Storage Domain

### New Domain: AgentVersionsStorage

**File**: `packages/core/src/storage/domains/agent-versions/base.ts`

```typescript
abstract class AgentVersionsStorage extends StorageDomain {
  abstract createVersion(version: AgentVersion): Promise<AgentVersion>;
  abstract getVersion(id: string): Promise<AgentVersion | null>;
  abstract getLatestVersion(agentId: string): Promise<AgentVersion | null>;
  abstract listVersions(input: ListVersionsInput): Promise<ListVersionsOutput>;
  abstract deleteVersion(id: string): Promise<void>;
  abstract deleteVersionsByAgentId(agentId: string): Promise<void>;
}
```

### Implementations Needed

- `packages/core/src/storage/domains/agent-versions/inmemory.ts`
- `stores/pg/src/storage/domains/agent-versions/index.ts`
- `stores/libsql/src/storage/domains/agent-versions/index.ts`
- (Other store adapters as needed)

---

## Client SDK

### New Methods

```typescript
// In stored agent resource
client.getStoredAgent(agentId).listVersions(params?)
client.getStoredAgent(agentId).createVersion(params)
client.getStoredAgent(agentId).getVersion(versionId)
client.getStoredAgent(agentId).activateVersion(versionId)
client.getStoredAgent(agentId).restoreVersion(versionId)
client.getStoredAgent(agentId).deleteVersion(versionId)
client.getStoredAgent(agentId).compareVersions(fromId, toId)
```

### New Types

```typescript
export interface AgentVersionResponse {
  id: string;
  agentId: string;
  versionNumber: number;
  name?: string;
  snapshot: StoredAgentResponse;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

export interface ListAgentVersionsResponse {
  versions: AgentVersionResponse[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface CreateAgentVersionParams {
  name?: string;
  changeMessage?: string;
}

export interface CompareVersionsResponse {
  diffs: AgentVersionDiff[];
  fromVersion: AgentVersionResponse;
  toVersion: AgentVersionResponse;
}
```

---

## Hooks (playground-ui)

**New File**: `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts`

```typescript
export const useAgentVersions = (agentId: string) => {...}
export const useAgentVersion = (agentId: string, versionId: string) => {...}
export const useCreateAgentVersion = (agentId: string) => {...}
export const useActivateAgentVersion = (agentId: string) => {...}
export const useRestoreAgentVersion = (agentId: string) => {...}
export const useDeleteAgentVersion = (agentId: string) => {...}
export const useCompareAgentVersions = (agentId: string) => {...}
```

---

## Versioning File Structure (New/Modified)

```
packages/core/src/storage/
├── constants.ts                           # MODIFIED - add TABLE_AGENT_VERSIONS
├── domains/
│   ├── agent-versions/
│   │   ├── base.ts                        # NEW
│   │   ├── inmemory.ts                    # NEW
│   │   └── index.ts                       # NEW
│   └── agents/
│       └── base.ts                        # MODIFIED - add activeVersionId

packages/server/src/server/
├── schemas/
│   └── agent-versions.ts                  # NEW
├── handlers/
│   └── agent-versions.ts                  # NEW
└── server-adapter/routes/
    └── agent-versions.ts                  # NEW

stores/pg/src/storage/domains/
└── agent-versions/
    └── index.ts                           # NEW

client-sdks/client-js/src/
├── resources/
│   └── stored-agent.ts                    # MODIFIED - add version methods
└── types.ts                               # MODIFIED - add version types

packages/playground-ui/src/domains/agents/
├── components/
│   ├── agent-versions/
│   │   ├── index.tsx                      # NEW
│   │   ├── agent-versions.tsx             # NEW - main versions list
│   │   ├── version-list-item.tsx          # NEW
│   │   ├── save-version-dialog.tsx        # NEW
│   │   ├── version-compare-dialog.tsx     # NEW
│   │   ├── version-detail-dialog.tsx      # NEW
│   │   └── version-diff-view.tsx          # NEW - side-by-side diff
│   └── agent-information/
│       └── agent-information.tsx          # MODIFIED - add Versions tab
├── hooks/
│   └── use-agent-versions.ts              # NEW
└── index.tsx                              # MODIFIED - exports
```

---

## Versioning Task Summary

| #   | Task                                           | Files       | Complexity |
| --- | ---------------------------------------------- | ----------- | ---------- |
| V1  | Add `TABLE_AGENT_VERSIONS` schema              | 1 file      | Low        |
| V2  | Create `AgentVersionsStorage` base class       | 1 new file  | Medium     |
| V3  | Create in-memory implementation                | 1 new file  | Medium     |
| V4  | Create PostgreSQL implementation               | 1 new file  | Medium     |
| V5  | Add version server routes & handlers           | 3 new files | High       |
| V6  | Modify agents schema (add `activeVersionId`)   | 2 files     | Low        |
| V7  | Update `getStoredAgent` for version resolution | 1 file      | Medium     |
| V8  | Add version methods to client SDK              | 2 files     | Medium     |
| V9  | Create `useAgentVersions` hooks                | 1 new file  | Medium     |
| V10 | Create `AgentVersions` list component          | 2 new files | Medium     |
| V11 | Create `SaveVersionDialog` component           | 1 new file  | Medium     |
| V12 | Create `VersionCompareDialog` with diff view   | 2 new files | High       |
| V13 | Add "Versions" tab to `AgentInformation`       | 1 file      | Low        |
| V14 | Add version badge to `AgentEntityHeader`       | 1 file      | Low        |
| V15 | Implement retention enforcement                | 1 file      | Medium     |

**Total**: 15 versioning tasks

---

## Implementation Order

### Phase 1A: Core CRUD (Tasks 1-15 from above)

1. Schema + Storage domain
2. Server routes
3. Client SDK
4. UI components for create/edit/delete

### Phase 1B: Versioning (Tasks V1-V15)

1. **Storage Layer** (V1-V4, V6): Schema, base class, implementations
2. **Server Layer** (V5, V7): Routes, version resolution
3. **Client SDK** (V8): Version methods
4. **UI - Basic** (V9, V10, V11, V13, V14): Hooks, list, save dialog, tab, badge
5. **UI - Advanced** (V12, V15): Compare dialog, retention

---

## Parallelization Guide

This section helps coordinate work across multiple Claude instances.

### Dependency Graph

```
                         FOUNDATION (Must go first)
                    ┌────────────────────────────────┐
                    │  Task 1: source field schema   │
                    │  V1 + V6: version schema       │
                    └──────────────┬─────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
    WORKER A               WORKER B                    WORKER C
    (Backend)              (UI Components)             (Version Backend)
         │                         │                         │
    Task 7: Memory           Task 3: Model Picker      V2-V4: Storage
    Configs API              Task 4: Multi-Select      Domain
         │                   Task 5: Validation              │
         │                         │                         │
         │                         ▼                         ▼
         │                   Task 6: Agent Form        V5: Server Routes
         │                         │                   V7: Resolution
         │                         │                         │
         │                         ▼                         ▼
         │                   Task 8-10: Dialogs        V8: Client SDK
         │                         │                         │
         │                         ▼                         ▼
         │                   Task 11-14: Page          V9: Hooks
         │                   Integration               V10-15: UI
         │                         │                         │
         └─────────────────────────┴─────────────────────────┘
                                   │
                                   ▼
                         Task 15: Final Exports
```

### Work Packages for Parallel Execution

#### WORKER A: Foundation + Backend Core

**Scope**: Schema changes + Memory API
**Files touched**:

- `packages/core/src/agent/types.ts`
- `packages/core/src/mastra/index.ts`
- `packages/server/src/server/schemas/agents.ts`
- `packages/server/src/server/handlers/agents.ts`
- `packages/server/src/server/handlers/memory.ts`
- `client-sdks/client-js/src/types.ts`
- `client-sdks/client-js/src/client.ts`

**Tasks**: 1, 7

---

#### WORKER B: UI Components (Pure Frontend)

**Scope**: All reusable UI components and form logic
**Files touched**:

- `packages/playground-ui/src/domains/agents/components/create-agent/*` (NEW)
- `packages/playground-ui/src/domains/agents/hooks/use-stored-agents.ts` (NEW)
- `packages/playground-ui/src/domains/memory/hooks/use-memory-configs.ts` (NEW)

**Tasks**: 2, 3, 4, 5, 6, 8, 9, 10

**Note**: Can start Tasks 3, 4, 5 immediately (no dependencies). Task 6 needs 3, 4, 5. Tasks 8, 9, 10 need 6.

---

#### WORKER C: Version Storage + Server

**Scope**: All versioning backend infrastructure
**Files touched**:

- `packages/core/src/storage/constants.ts`
- `packages/core/src/storage/domains/agent-versions/*` (NEW)
- `packages/server/src/server/schemas/agent-versions.ts` (NEW)
- `packages/server/src/server/handlers/agent-versions.ts` (NEW)
- `stores/pg/src/storage/domains/agent-versions/*` (NEW)
- `client-sdks/client-js/src/resources/stored-agent.ts`

**Tasks**: V1, V2, V3, V4, V5, V6, V7, V8

**Note**: V1+V6 first (schema), then V2-V4 (storage), then V5+V7 (server), then V8 (client SDK)

---

#### WORKER D: Version UI

**Scope**: All versioning UI components
**Files touched**:

- `packages/playground-ui/src/domains/agents/components/agent-versions/*` (NEW)
- `packages/playground-ui/src/domains/agents/hooks/use-agent-versions.ts` (NEW)
- `packages/playground-ui/src/domains/agents/components/agent-information/agent-information.tsx`
- `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`

**Tasks**: V9, V10, V11, V12, V13, V14, V15

**Note**: Depends on WORKER C completing V8 for hooks (V9). But V10, V11 UI shells can start immediately.

---

#### WORKER E: Page Integration

**Scope**: Integrating components into existing pages
**Files touched**:

- `packages/playground-ui/src/domains/agents/components/agent-table/*`
- `packages/playground-ui/src/domains/agents/components/agent-entity-header.tsx`
- `packages/playground/src/pages/agents/index.tsx`
- `packages/playground-ui/src/domains/agents/index.tsx`

**Tasks**: 11, 12, 13, 14, 15

**Note**: Depends on WORKER B completing dialogs (Tasks 8-10)

---

### Execution Phases

| Phase | Workers | Tasks                               | Blocker |
| ----- | ------- | ----------------------------------- | ------- |
| **1** | A       | Task 1 (source field)               | None    |
| **1** | C       | V1 + V6 (version schema)            | None    |
| **2** | A       | Task 7 (Memory API)                 | Phase 1 |
| **2** | B       | Tasks 3, 4, 5 (Pickers, Validation) | None    |
| **2** | C       | V2, V3, V4 (Storage domain)         | Phase 1 |
| **2** | D       | V10, V11 shells (Version UI)        | None    |
| **3** | B       | Task 2 (Hooks), Task 6 (Form)       | Phase 2 |
| **3** | C       | V5, V7 (Server routes)              | Phase 2 |
| **4** | B       | Tasks 8, 9, 10 (Dialogs)            | Phase 3 |
| **4** | C       | V8 (Client SDK)                     | Phase 3 |
| **5** | D       | V9 (Hooks), V12-V15 (UI)            | Phase 4 |
| **5** | E       | Tasks 11-14 (Integration)           | Phase 4 |
| **6** | Any     | Task 15 (Exports)                   | Phase 5 |

### File Ownership (Avoid Conflicts)

| Directory/File                                          | Owner                                  |
| ------------------------------------------------------- | -------------------------------------- |
| `packages/core/src/storage/domains/agent-versions/`     | WORKER C                               |
| `packages/core/src/storage/domains/agents/`             | WORKER A (small change)                |
| `packages/server/src/server/handlers/agent-versions.ts` | WORKER C                               |
| `packages/server/src/server/handlers/memory.ts`         | WORKER A                               |
| `packages/server/src/server/handlers/agents.ts`         | WORKER A                               |
| `packages/playground-ui/.../create-agent/`              | WORKER B                               |
| `packages/playground-ui/.../agent-versions/`            | WORKER D                               |
| `packages/playground-ui/.../agent-table/`               | WORKER E                               |
| `packages/playground/src/pages/agents/`                 | WORKER E                               |
| `client-sdks/client-js/src/types.ts`                    | WORKER A (source), WORKER C (versions) |
| `stores/pg/src/storage/domains/agent-versions/`         | WORKER C                               |

### Handoff Points

1. **A → B**: After Task 1, B can use `source` field in UI
2. **C → D**: After V8, D can build hooks against client SDK
3. **B → E**: After Tasks 8-10, E can integrate dialogs into pages
4. **All → Any**: Task 15 (exports) is final cleanup

---

## Phase 2 (Future)

- **Memory UI Setup**: Create memory configurations from UI
- **Duplicate Agent**: Clone an existing agent as starting point
- **Import/Export**: JSON import/export for agent configurations
- **Version Branching**: Create variant agents from any version
