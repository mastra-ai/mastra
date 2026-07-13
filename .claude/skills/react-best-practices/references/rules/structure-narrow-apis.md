---
title: Keep Input and Output APIs Narrow
impact: MEDIUM-HIGH
impactDescription: oversized APIs hide mixed responsibilities, couple callers to unrelated behavior, and make units harder to understand, test, change, and reuse
tags: structure, api-design, props, arguments, return-values, hooks, components, functions, utilities, maintainability
---

## Keep Input and Output APIs Narrow

A component, hook, function, or utility must expose a focused API. Requiring many unrelated props or arguments, or returning a large bag of unrelated values and handlers, is evidence that the unit owns too many responsibilities.

Moving the same values into one parameter object does **not** make the API narrow. This changes the syntax, not the responsibility boundary:

```tsx
// Still an oversized API: one object contains the same unrelated inputs.
useWorkspaceController({
  workspaceId,
  query,
  sort,
  page,
  selectedIds,
  draftName,
  draftDescription,
  permissions,
  // ...more unrelated inputs
});
```

There is no universal maximum count. A hook accepting 16 inputs and returning an object with 30 fields is an obvious review smell, but those numbers are deliberately arbitrary. Judge whether the values belong to one cohesive responsibility, not whether the API falls just below a numeric threshold.

**Incorrect (one hook owns querying, pagination, selection, and editing):**

```tsx
function useWorkspaceController({
  workspaceId,
  query,
  sort,
  page,
  pageSize,
  selectedIds,
  draftName,
  draftDescription,
  canEdit,
  onSave,
  // ...more inputs
}: WorkspaceControllerOptions) {
  // Fetching, filtering, pagination, selection, permissions, and form state.

  return {
    items,
    total,
    isLoading,
    error,
    query,
    setQuery,
    sort,
    setSort,
    page,
    setPage,
    selectedIds,
    selectItem,
    clearSelection,
    draftName,
    setDraftName,
    draftDescription,
    setDraftDescription,
    save,
    canSave,
    // ...more unrelated values and handlers
  };
}
```

**Correct (split responsibilities and compose them at the component level):**

```tsx
function useWorkspaceSearch(workspaceId: string) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<WorkspaceSort>('updated');
  const result = useWorkspaceItems({ workspaceId, query, sort });

  return { query, setQuery, sort, setSort, ...result };
}

function usePagination(total: number) {
  const [page, setPage] = useState(1);
  return { page, setPage, pageCount: Math.ceil(total / 20) };
}

function useSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return { selectedIds, setSelectedIds };
}

function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const search = useWorkspaceSearch(workspaceId);
  const pagination = usePagination(search.total);
  const selection = useSelection();

  return (
    <WorkspaceView
      search={search}
      pagination={pagination}
      selection={selection}
    />
  );
}
```

The component or container is the assembly point: it may compose several focused hooks and pass each focused result to the child that needs it. Do not create another mega-hook merely to hide composition from the component.

Apply the same rule outside hooks:

- Split a component whose props span unrelated domains into focused child components.
- Split a function or utility that needs unrelated argument groups into cohesive operations.
- Return only the values owned by that responsibility; do not expose internal state or unrelated convenience fields "just in case."
- Group values into an object when they form one meaningful concept, not to disguise a long argument list.

Review smells: callers pass values they do not otherwise use, most callers destructure only a small subset of a return object, inputs and outputs fall into named clusters, changes for unrelated features keep touching the same API, or the unit cannot be described without "and."

This complements [`structure-single-responsibility`](./structure-single-responsibility.md): that rule defines ownership and file boundaries; this rule uses API breadth as a signal that the ownership boundary must be split.
