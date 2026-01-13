# Worker B: UI Components (Pure Frontend)

> **Role**: All reusable UI components and form logic  
> **Priority**: HIGH - Core user-facing features  
> **Status**: IN PROGRESS

---

## Overview

Worker B builds all the reusable UI components for creating and editing agents. This includes pickers, form validation, the main form, and dialogs.

---

## Dependencies

- **Task 1** (Worker A): ✅ COMPLETE - `source` field available
- **Task 7** (Worker A): 🔲 TODO - Need `listMemoryConfigs()` for memory picker

**Can start immediately**: Tasks 3, 4, 5, 6, 8, 9, 10 (Task 1 dependency satisfied)

---

## ✅ COMPLETED Tasks

### Task 2: Create Stored Agent Hooks ✅

**Status**: COMPLETE (PR #11847)

**Goal**: React Query mutations for stored agent CRUD.

**File**: `packages/playground-ui/src/domains/agents/hooks/use-stored-agents.ts`

Implemented:

- `useStoredAgents(params?)` - List stored agents with filtering
- `useStoredAgent(agentId?)` - Get single stored agent details
- `useStoredAgentMutations(agentId?)` - Create, update, delete mutations

---

## 🔲 REMAINING Tasks

### Task 3: Create Model Picker Component

**Priority**: HIGH  
**Status**: TODO
**Depends on**: None (can start immediately)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateStoredAgentParams, UpdateStoredAgentParams } from '@mastra/client-js';

export const useCreateStoredAgent = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (params: CreateStoredAgentParams) => client.createStoredAgent(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useUpdateStoredAgent = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: (params: UpdateStoredAgentParams) => client.getStoredAgent(agentId).update(params, requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  });
};

export const useDeleteStoredAgent = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: () => client.getStoredAgent(agentId).delete(requestContext),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};
```

---

### Task 3: Create Model Picker Component ✅

**Status**: COMPLETE (PR #11852)

**Goal**: Reusable provider + model selector.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/model-picker.tsx`

**Reference**: Extract and simplify from `agent-metadata-model-switcher.tsx` (lines 1-706)

**Features**:

- Provider dropdown with connection status (green/red dot)
- Model dropdown filtered by selected provider
- Warning alert when provider not connected
- Custom model ID support
- Keyboard navigation

**Props**:

```typescript
interface ModelPickerProps {
  value: { provider: string; name: string };
  onChange: (value: { provider: string; name: string }) => void;
  error?: string;
}
```

**Key differences from existing component**:

- No auto-save behavior (controlled component)
- No reset button
- Returns value via onChange instead of calling API
- Simpler state management

---

### Task 4: Create Multi-Select Picker Component ✅

**Status**: COMPLETE (PR #11850)

**Goal**: Generic multi-select for tools, workflows, sub-agents, memory.

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
  getOptionDescription?: (option: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  singleSelect?: boolean; // For memory picker (radio instead of checkbox)
  error?: string;
}
```

**Features**:

- Popover with search input
- Checkbox/radio selection based on `singleSelect`
- Selected items shown as removable badges
- Empty state message
- Keyboard navigation

**UI Structure**:

```
[Selected: Tool A, Tool B ▼]
┌─────────────────────────────┐
│ 🔍 Search tools...          │
├─────────────────────────────┤
│ ☑ Tool A                    │
│   Description of Tool A     │
│ ☑ Tool B                    │
│ ☐ Tool C                    │
│ ☐ Tool D                    │
└─────────────────────────────┘
```

---

### Task 5: Create Form Validation Schema ✅

**Status**: COMPLETE (PR #11851)

**Goal**: Zod schema and validation helpers.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/form-validation.ts`

```typescript
import { z } from 'zod';
import type { Provider } from '@mastra/client-js';

export const agentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
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

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validateReferences(
  values: AgentFormValues,
  availableTools: string[],
  availableWorkflows: string[],
  availableAgents: string[],
  availableMemory: string[],
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Check tools exist
  const invalidTools = values.tools?.filter(t => !availableTools.includes(t)) || [];
  if (invalidTools.length > 0) {
    errors.tools = `Unknown tools: ${invalidTools.join(', ')}`;
  }

  // Check workflows exist
  const invalidWorkflows = values.workflows?.filter(w => !availableWorkflows.includes(w)) || [];
  if (invalidWorkflows.length > 0) {
    errors.workflows = `Unknown workflows: ${invalidWorkflows.join(', ')}`;
  }

  // Check agents exist
  const invalidAgents = values.agents?.filter(a => !availableAgents.includes(a)) || [];
  if (invalidAgents.length > 0) {
    errors.agents = `Unknown agents: ${invalidAgents.join(', ')}`;
  }

  // Check memory exists
  if (values.memory && !availableMemory.includes(values.memory)) {
    errors.memory = `Unknown memory config: ${values.memory}`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

export function isProviderConnected(provider: string, providers: Provider[]): boolean {
  const found = providers.find(p => p.id === provider || p.id.startsWith(provider));
  return found?.connected ?? false;
}

export function getProviderWarning(provider: string, providers: Provider[]): string | null {
  const found = providers.find(p => p.id === provider || p.id.startsWith(provider));
  if (found && !found.connected) {
    const envVar = Array.isArray(found.envVar) ? found.envVar.join(', ') : found.envVar;
    return `Provider "${found.name}" is not connected. Set ${envVar} to use this provider.`;
  }
  return null;
}
```

---

### Task 6: Create Agent Form Component ✅

**Status**: COMPLETE (PR #11857)

**Goal**: Shared form for create and edit modes.

**New file**: `packages/playground-ui/src/domains/agents/components/create-agent/agent-form.tsx`

**Props**:

```typescript
interface AgentFormProps {
  mode: 'create' | 'edit';
  agentId?: string; // For edit mode, shown as badge
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void; // Only for edit mode
  isSubmitting?: boolean;
  isDeleting?: boolean;
  excludeAgentId?: string; // Exclude from sub-agents picker
}
```

**Data Fetching** (inside component):

```typescript
const { data: providers } = useAgentsModelProviders();
const { data: tools } = useTools();
const { data: workflows } = useWorkflows();
const { data: agents } = useAgents();
const { data: memoryConfigs } = useMemoryConfigs();
```

**Form Layout**:

- Use `react-hook-form` with `@hookform/resolvers/zod`
- Simple mode: name, description, model, instructions
- Advanced mode (collapsible): tools, workflows, agents, memory
- Footer: Delete button (edit only), Cancel, Submit

**State**:

```typescript
const [showAdvanced, setShowAdvanced] = useState(false);
```

---

### Task 8: Create Agent Dialog ✅

**Status**: COMPLETE (PR #11860)

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

**Implementation**:

```typescript
export function CreateAgentDialog({ open, onOpenChange, onSuccess }: CreateAgentDialogProps) {
  const { mutateAsync: createAgent, isPending } = useCreateStoredAgent();

  const handleSubmit = async (values: AgentFormValues) => {
    const agentId = crypto.randomUUID();
    await createAgent({
      id: agentId,
      ...values,
      model: values.model as Record<string, unknown>,
    });
    onSuccess?.(agentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Create a new agent with custom instructions and capabilities.
          </DialogDescription>
        </DialogHeader>
        <AgentForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
```

---

### Task 9: Edit Agent Dialog ✅

**Status**: COMPLETE (PR #11859)

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

**Implementation**:

- Fetch current agent config with `client.getStoredAgent(agentId).details()`
- Show loading skeleton while fetching
- Pre-fill form with current values
- Handle update via `useUpdateStoredAgent`
- Handle delete flow (opens confirmation)

---

### Task 10: Delete Agent Confirmation ✅

**Status**: COMPLETE (PR #11859)

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

**Use existing `AlertDialog` component** from `@/components/ui/alert-dialog`

---

## New Directory Structure

```
packages/playground-ui/src/domains/agents/components/create-agent/
├── index.tsx                  # Barrel exports
├── agent-form.tsx             # Task 6
├── model-picker.tsx           # Task 3
├── multi-select-picker.tsx    # Task 4
├── form-validation.ts         # Task 5
├── create-agent-dialog.tsx    # Task 8
├── edit-agent-dialog.tsx      # Task 9
└── delete-agent-confirm.tsx   # Task 10
```

---

## File Ownership

Worker B owns these files exclusively:

- `packages/playground-ui/src/domains/agents/components/create-agent/*` (all new)
- `packages/playground-ui/src/domains/agents/hooks/use-stored-agents.ts` (new)

Worker B creates, Worker D references:

- Export patterns that Worker D may import for consistency

---

## Handoff

After completing Tasks 3, 4, 5:

- Task 6 can proceed (internal dependency)

After completing Tasks 8, 9, 10:

- Notify Worker E that dialogs are ready for page integration
- Worker E can now wire up `CreateAgentDialog` in agents page

---

## Testing Checklist

- [x] Stored agent hooks work (useStoredAgents, useStoredAgent, useStoredAgentMutations)
- [ ] Model Picker renders and allows selection
- [ ] Model Picker shows provider connection status
- [x] Multi-Select Picker works for tools/workflows/agents
- [x] Multi-Select Picker single-select mode works for memory
- [x] Form validation shows errors for required fields
- [x] Form validation warns about disconnected providers
- [x] Model Picker renders and allows selection
- [x] Model Picker shows provider connection status
- [ ] Agent Form renders in create mode
- [ ] Agent Form renders in edit mode with pre-filled values
- [ ] Advanced options collapsible works
- [ ] Create dialog creates agent and returns ID
- [ ] Edit dialog loads agent, allows edit, saves changes
- [ ] Delete confirmation works
