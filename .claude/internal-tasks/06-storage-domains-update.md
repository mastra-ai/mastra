# Task 06: Update StorageDomains Type

## Summary

Add inbox to the StorageDomains type so it can be registered with MastraStorage.

## File to Modify

`packages/core/src/storage/base.ts`

## Changes Required

### 1. Import InboxStorage

```typescript
import type { InboxStorage } from '../inbox';
```

### 2. Update StorageDomains Type

Find the `StorageDomains` type and add inbox:

```typescript
export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
  inbox?: InboxStorage; // ADD THIS
};
```

### 3. Update MastraStorage.init()

If there's an init method that initializes domains, add inbox:

```typescript
async init(): Promise<void> {
  // ... existing code ...

  if (this.stores?.inbox) {
    initTasks.push(this.stores.inbox.init());
  }

  // ... existing code ...
}
```

## Reference

Look at how other optional domains (observability, agents) are handled.

## Acceptance Criteria

- [ ] InboxStorage imported
- [ ] inbox added to StorageDomains type as optional
- [ ] init() handles inbox initialization if present
- [ ] File passes typecheck
- [ ] Existing functionality not broken
