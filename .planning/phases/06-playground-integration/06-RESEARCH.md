# Phase 6: Playground Integration - Research

**Researched:** 2026-01-26
**Domain:** React UI Components for Dataset Evaluation Workflows
**Confidence:** HIGH

## Summary

Researched Mastra's playground-ui patterns for implementing the dataset evaluation UI. The codebase has well-established patterns for:
1. **Domain structure**: `packages/playground-ui/src/domains/{name}/` with hooks, components, and context
2. **Data fetching**: TanStack Query with `useMastraClient()` hook for all API calls
3. **UI components**: Design system in `packages/playground-ui/src/ds/components/` with Table, Dialog, SideDialog, EmptyState, Button, etc.
4. **Page composition**: `packages/playground/` composes pages using playground-ui primitives via React Router

Key insight: Phase 6 requires zero new dependencies — all UI patterns exist. The work is composition and wiring to backend APIs from Phases 1-2 (datasets, runs storage) and Phase 5 (compareRuns analytics).

**Primary recommendation:** Create `packages/playground-ui/src/domains/datasets/` with hooks (useDatasets, useDataset, useDatasetRuns, useDatasetRunResults, useCompareRuns), components (DatasetsTable, DatasetDetail, RunTriggerDialog, ResultsTable, ComparisonView), and compose pages in `packages/playground/src/pages/datasets/`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/playground-ui | internal | UI primitives, hooks, design system | All playground pages use this |
| @mastra/client-js | internal | API client | Standard for playground data fetching |
| @tanstack/react-query | ^5.x | Server state management | Already used by all playground hooks |
| @tanstack/react-table | ^8.x | Table rendering | Already used by AgentsTable, WorkflowsTable |
| react-router | ^7.x | Routing (local studio) | Standard for packages/playground |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.x | Icons | All icons in playground |
| sonner | ^1.x | Toast notifications | Error/success feedback |
| @radix-ui/react-* | various | Accessible primitives | Dialog, VisuallyHidden, etc. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SideDialog for results | Full-page modal | SideDialog matches traces pattern (decided) |
| Checkboxes for run compare | Dropdown select | Checkboxes more visual (decided) |

**Installation:**
```bash
# No new packages needed - all dependencies already in playground-ui
```

## Architecture Patterns

### Recommended Project Structure
```
packages/playground-ui/src/domains/
└── datasets/
    ├── index.ts                    # Re-exports
    ├── hooks/
    │   ├── use-datasets.ts         # useDatasets, useDataset
    │   ├── use-dataset-runs.ts     # useDatasetRuns, useDatasetRunResults
    │   └── use-compare-runs.ts     # useCompareRuns
    └── components/
        ├── datasets-table/
        │   ├── datasets-table.tsx
        │   ├── columns.tsx
        │   └── types.ts
        ├── dataset-detail/
        │   ├── dataset-detail.tsx
        │   ├── items-list.tsx
        │   └── run-history.tsx
        ├── create-dataset-dialog.tsx
        ├── run-trigger/
        │   ├── run-trigger-dialog.tsx
        │   ├── target-selector.tsx
        │   └── scorer-selector.tsx
        ├── results/
        │   ├── results-table.tsx
        │   ├── result-detail-dialog.tsx
        │   └── result-row.tsx
        └── comparison/
            ├── comparison-view.tsx
            └── score-delta.tsx

packages/playground/src/
├── pages/
│   └── datasets/
│       ├── index.tsx               # Datasets list page
│       └── dataset/
│           └── index.tsx           # Dataset detail page
└── components/ui/
    └── app-sidebar.tsx             # Add Datasets nav item
```

### Pattern 1: Domain Hook Structure
**What:** TanStack Query hooks wrapping MastraClient
**When to use:** All data fetching for datasets/runs
**Example:**
```typescript
// Source: packages/playground-ui/src/domains/agents/hooks/use-agents.ts pattern
import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useDatasets = () => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () => client.listDatasets(),
  });
};

export const useDataset = (datasetId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => client.getDataset(datasetId),
    enabled: Boolean(datasetId),
  });
};
```

### Pattern 2: Table with TanStack React Table
**What:** Composable table with columns, search, and row click navigation
**When to use:** DatasetsTable, ResultsTable
**Example:**
```typescript
// Source: packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Table, Thead, Tbody, Row, Cell, Th } from '@/ds/components/Table';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';

export function DatasetsTable({ datasets, isLoading, onCreateClick }) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const table = useReactTable({
    data: datasets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (datasets.length === 0 && !isLoading) {
    return <EmptyDatasetsTable onCreateClick={onCreateClick} />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search datasets" placeholder="Search datasets" />
      </SearchbarWrapper>
      <ScrollableContainer>
        <Table>
          <Thead>...</Thead>
          <Tbody>
            {table.getRowModel().rows.map(row => (
              <Row key={row.id} onClick={() => navigate(paths.datasetLink(row.original.id))}>
                ...
              </Row>
            ))}
          </Tbody>
        </Table>
      </ScrollableContainer>
    </div>
  );
}
```

### Pattern 3: Create Dialog Pattern
**What:** Modal dialog with form for creating entities
**When to use:** CreateDatasetDialog
**Example:**
```typescript
// Source: packages/playground-ui/src/domains/agents/components/create-agent/create-agent-dialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { toast } from '@/lib/toast';

export function CreateDatasetDialog({ open, onOpenChange, onSuccess }) {
  const { createDataset } = useDatasetMutations();

  const handleSubmit = async (values: DatasetFormValues) => {
    try {
      const result = await createDataset.mutateAsync(values);
      toast.success('Dataset created successfully');
      onOpenChange(false);
      onSuccess?.(result.id);
    } catch (error) {
      toast.error(`Failed to create dataset: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
        </DialogHeader>
        <DatasetForm onSubmit={handleSubmit} isSubmitting={createDataset.isPending} />
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: SideDialog for Detail Views
**What:** Slide-in panel for viewing details without full navigation
**When to use:** Result detail view, trace integration
**Example:**
```typescript
// Source: packages/playground-ui/src/domains/observability/components/trace-dialog.tsx
import { SideDialog } from '@/ds/components/SideDialog';

export function ResultDetailDialog({ result, isOpen, onClose, onNext, onPrevious }) {
  return (
    <SideDialog
      dialogTitle="Run Result"
      dialogDescription="View result details"
      isOpen={isOpen}
      onClose={onClose}
      level={2}
    >
      <SideDialog.Top>
        <TextAndIcon><HashIcon /> {result.itemId}</TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>Result Details</SideDialog.Heading>
        </SideDialog.Header>
        {/* Tabs for Input, Output, Scores, Trace */}
      </SideDialog.Content>
    </SideDialog>
  );
}
```

### Pattern 5: Polling for In-Progress Runs
**What:** refetchInterval with conditional enable
**When to use:** Run progress updates
**Example:**
```typescript
// Source: packages/playground-ui/src/hooks/use-workflow-runs.ts
export const useDatasetRun = (runId: string) => {
  const client = useMastraClient();
  const query = useQuery({
    queryKey: ['dataset-run', runId],
    queryFn: () => client.getDatasetRun(runId),
    enabled: Boolean(runId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: (query) => {
      // Poll while running, stop when complete
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });
  return query;
};
```

### Pattern 6: Sidebar Navigation Integration
**What:** Add nav section to app-sidebar.tsx
**When to use:** Adding Datasets entry
**Example:**
```typescript
// Source: packages/playground/src/components/ui/app-sidebar.tsx
// Add to mainNavigation array, under observability section:
{
  key: 'observability',
  separator: true,
  links: [
    {
      name: 'Observability',
      url: '/observability',
      icon: <EyeIcon />,
      isOnMastraPlatform: true,
    },
    {
      name: 'Datasets',
      url: '/datasets',
      icon: <DatabaseIcon />,  // or TableIcon
      isOnMastraPlatform: true,
    },
  ],
},
```

### Anti-Patterns to Avoid
- **Business logic in playground package:** All data fetching, mutations go in playground-ui
- **Direct fetch calls:** Always use useMastraClient() + TanStack Query
- **Custom loading states:** Use isLoading from useQuery, Skeleton components
- **Hardcoded URLs:** Use useLinkComponent().paths for navigation
- **Missing empty states:** Every list needs EmptyState component

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data fetching | Custom fetch | useMastraClient + useQuery | Cache, deduplication, refetching |
| Table rendering | Manual map | @tanstack/react-table | Sorting, filtering, virtualization |
| Modals | Custom overlay | Dialog from ds/components | Accessibility, styling |
| Detail panels | Custom sidebar | SideDialog from ds/components | Consistent with traces |
| Progress feedback | Custom spinner | ProcessStepProgressBar or inline % | Existing patterns |
| Icons | Custom SVGs | lucide-react | Consistent icon set |
| Toast messages | alert() | sonner/toast | Non-blocking, styled |

**Key insight:** The design system has 40+ components. Use them.

## Common Pitfalls

### Pitfall 1: Breaking Package Boundaries
**What goes wrong:** Components in packages/playground instead of playground-ui
**Why it happens:** Seems faster to add in page file
**How to avoid:**
- Components go in playground-ui/src/domains/
- Pages in playground are composition only
- Check CLAUDE.md in each package
**Warning signs:** Imports between packages don't work, storybook can't render

### Pitfall 2: Missing Query Invalidation
**What goes wrong:** UI doesn't update after mutation
**Why it happens:** Forgot to invalidate related queries
**How to avoid:**
```typescript
const queryClient = useQueryClient();
await createDataset.mutateAsync(params);
queryClient.invalidateQueries({ queryKey: ['datasets'] });
```
**Warning signs:** Refresh needed to see changes

### Pitfall 3: Stale Closure in Polling
**What goes wrong:** Polling continues after navigation or status change
**Why it happens:** refetchInterval uses stale value
**How to avoid:** Use function form that receives query state:
```typescript
refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false
```
**Warning signs:** Network tab shows continuous requests

### Pitfall 4: Comparison Items Don't Align
**What goes wrong:** Side-by-side columns don't match by item
**Why it happens:** Different item ordering between runs
**How to avoid:**
- Build lookup by itemId
- Handle missing items (show placeholder)
- Check versionMismatch flag from compareRuns
**Warning signs:** Rows don't match visually

### Pitfall 5: Missing Error Boundaries
**What goes wrong:** One component error crashes whole page
**Why it happens:** No error isolation
**How to avoid:** Wrap each major section in error boundary
**Warning signs:** White screen on component error

### Pitfall 6: Large Result Sets
**What goes wrong:** UI freezes with 1000+ items
**Why it happens:** Rendering all rows at once
**How to avoid:**
- Use pagination (server-side via API)
- Consider virtualization for long lists
- Show warning for large datasets
**Warning signs:** UI lag when scrolling results

## Code Examples

### Page Composition Pattern
```typescript
// packages/playground/src/pages/datasets/index.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  useLinkComponent,
  DocsIcon,
  useDatasets,
  DatasetsTable,
  DatabaseIcon,
  CreateDatasetDialog,
} from '@mastra/playground-ui';

function Datasets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { data: datasets = [], isLoading } = useDatasets();

  const handleDatasetCreated = (datasetId: string) => {
    setIsCreateDialogOpen(false);
    navigate(paths.datasetLink(datasetId));
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon><DatabaseIcon /></Icon>
          Datasets
        </HeaderTitle>
        <HeaderAction>
          <Button variant="light" onClick={() => setIsCreateDialogOpen(true)}>
            <Icon><Plus /></Icon>
            Create Dataset
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && datasets.length === 0}>
        <DatasetsTable
          datasets={datasets}
          isLoading={isLoading}
          onCreateClick={() => setIsCreateDialogOpen(true)}
        />
      </MainContentContent>

      <CreateDatasetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleDatasetCreated}
      />
    </MainContentLayout>
  );
}

export { Datasets };
export default Datasets;
```

### Run Trigger Dialog Pattern
```typescript
// packages/playground-ui/src/domains/datasets/components/run-trigger/run-trigger-dialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ds/components/Select';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export function RunTriggerDialog({ datasetId, open, onOpenChange, onSuccess }) {
  const [targetType, setTargetType] = useState<'agent' | 'workflow'>('agent');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);

  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();
  const { triggerRun } = useDatasetMutations();

  const handleTrigger = async () => {
    const result = await triggerRun.mutateAsync({
      datasetId,
      targetType,
      targetId,
      scorerIds: selectedScorers,
    });
    onSuccess?.(result.runId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Evaluation</DialogTitle>
        </DialogHeader>

        {/* Target Type Selector */}
        <Select value={targetType} onValueChange={setTargetType}>
          <SelectTrigger>Target Type</SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
          </SelectContent>
        </Select>

        {/* Target Selector */}
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger>Select {targetType}</SelectTrigger>
          <SelectContent>
            {targetType === 'agent'
              ? Object.values(agents || {}).map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))
              : Object.values(workflows || {}).map(wf => (
                  <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                ))
            }
          </SelectContent>
        </Select>

        {/* Scorer Multi-Select */}
        <MultiSelectPicker
          label="Scorers (optional)"
          items={Object.values(scorers || {}).map(s => ({ id: s.id, name: s.name }))}
          selected={selectedScorers}
          onChange={setSelectedScorers}
        />

        <Button onClick={handleTrigger} isLoading={triggerRun.isPending}>
          Run
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

### Comparison View Pattern
```typescript
// packages/playground-ui/src/domains/datasets/components/comparison/comparison-view.tsx
import { useCompareRuns } from '../../hooks/use-compare-runs';
import { Alert } from '@/ds/components/Alert';

export function ComparisonView({ runIdA, runIdB }) {
  const { data: comparison, isLoading } = useCompareRuns(runIdA, runIdB);

  if (isLoading) return <Skeleton />;

  return (
    <div>
      {comparison.versionMismatch && (
        <Alert variant="warning">
          Dataset versions differ between runs. Some items may not align.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="font-medium">Run A: {comparison.runA.id}</div>
        <div className="font-medium">Run B: {comparison.runB.id}</div>
      </div>

      {/* Scorer summary */}
      {Object.entries(comparison.scorers).map(([scorerId, stats]) => (
        <div key={scorerId} className="flex items-center gap-2">
          <span>{scorerId}</span>
          <span>Avg: {stats.avgA.toFixed(2)} → {stats.avgB.toFixed(2)}</span>
          <ScoreDelta delta={stats.delta} regressed={stats.regressed} />
        </div>
      ))}

      {/* Per-item comparison table */}
      <Table>
        <Thead>
          <Th>Item</Th>
          <Th>Run A Output</Th>
          <Th>Run B Output</Th>
          <Th>Score Delta</Th>
        </Thead>
        <Tbody>
          {comparison.items.map(item => (
            <Row key={item.itemId}>
              <Cell>{item.itemId}</Cell>
              <Cell><OutputPreview value={item.outputA} /></Cell>
              <Cell><OutputPreview value={item.outputB} /></Cell>
              <Cell>
                {item.scores.map(s => (
                  <ScoreDelta key={s.scorerId} delta={s.delta} regressed={s.regressed} />
                ))}
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

function ScoreDelta({ delta, regressed }) {
  // Claude's discretion: arrows/colors for delta highlighting
  const color = regressed ? 'text-red-500' : delta > 0 ? 'text-green-500' : 'text-neutral3';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '–';
  return <span className={color}>{arrow} {Math.abs(delta).toFixed(2)}</span>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct DOM manipulation | React components | Always | Standard |
| Custom fetch | TanStack Query | 2024+ | Server state management |
| CSS classes | Tailwind + design tokens | Current | Consistent styling |
| Full page modals | SideDialog panels | 2025+ | Better context preservation |

**Deprecated/outdated:**
- N/A — building on current playground-ui patterns

## Open Questions

1. **Progress Bar Variant**
   - What we know: CONTEXT.md says "inline progress bar on dataset detail page"
   - What's unclear: Reuse ProcessStepProgressBar (step-based) or simple percentage bar?
   - Recommendation: Simple percentage bar with items completed / total items

2. **MastraClient Dataset API**
   - What we know: Need listDatasets, getDataset, createDataset, etc.
   - What's unclear: Not yet added to client-js in prior phases
   - Recommendation: Phase 6 must add client methods matching server routes from Phase 1-2

3. **Trace Embedding**
   - What we know: CONTEXT.md says "full trace view embedded in item detail dialog"
   - What's unclear: How to get traceId from run result?
   - Recommendation: RunResult should include traceId, use TraceDialog component

4. **useLinkComponent paths**
   - What we know: Paths like agentLink(id) exist
   - What's unclear: Need to add datasetLink, datasetRunLink paths
   - Recommendation: Extend useLinkComponent in playground-ui/lib/framework.tsx

## Sources

### Primary (HIGH confidence)
- `packages/playground-ui/src/domains/agents/` - Complete domain pattern
- `packages/playground-ui/src/domains/observability/` - SideDialog, trace patterns
- `packages/playground-ui/src/ds/components/` - Full design system
- `packages/playground/src/pages/agents/index.tsx` - Page composition
- `packages/playground/src/components/ui/app-sidebar.tsx` - Sidebar structure
- `packages/playground-ui/CLAUDE.md` - Package guidelines
- `packages/playground/CLAUDE.md` - Package guidelines

### Secondary (MEDIUM confidence)
- `packages/playground-ui/src/hooks/use-workflow-runs.ts` - Polling pattern
- `client-sdks/client-js/src/client.ts` - Client API patterns

### Tertiary (LOW confidence)
- None — all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use
- Architecture: HIGH — direct pattern from existing domains
- Pitfalls: HIGH — common React/playground issues documented

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days — UI patterns stable)
