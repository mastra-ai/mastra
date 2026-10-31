# General Principles

## Don't hide failure

A missing value, failed request, or partial result must be visible as such. In UI, show unavailable values as unavailable, failed requests as errors, and empty states only for successful empty results. Make loading, stale, or partial results visible instead of presenting them as current and complete. In code, propagate failures as thrown errors or typed failures; don't catch and continue with a silent default. Only use fake data when the task explicitly asks for a mock or demo.

**Incorrect (turns failed requests into successful empty results):**

```typescript
async function listAgents() {
  try {
    const response = await fetch('/api/agents');
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
```

**Correct (preserves the failure for the caller):**

```typescript
async function listAgents() {
  const response = await fetch('/api/agents');
  if (!response.ok) {
    throw new Error(`Failed to load agents (${response.status})`);
  }
  return response.json();
}
```

The caller can show a loading state while the request is pending, an error on rejection, and an empty state only after a successful empty response.

## Preserve intentional duplication across package boundaries

Don't couple behavior that should evolve independently. For derived values within a boundary, see [`structure-derive-dont-duplicate`](../typescript/structure/structure-derive-dont-duplicate.md).
