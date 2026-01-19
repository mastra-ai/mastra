# Task 05: Create Inbox Exports

## Summary

Create the index.ts file that exports all inbox-related types and classes.

## File to Create

`packages/core/src/inbox/index.ts`

## Exports

```typescript
// Types
export {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  ClaimFilter,
  ListFilter,
  InboxStats,
  IInbox,
  InboxConfig,
} from './types';

// Constants
export { TABLE_INBOX_TASKS, INBOX_TASKS_SCHEMA, DEFAULT_MAX_ATTEMPTS, DEFAULT_PRIORITY } from './constants';

// Classes
export { InboxStorage, InMemoryInboxStorage } from './inbox-storage';
export { Inbox } from './inbox';
```

## Acceptance Criteria

- [ ] All public types exported
- [ ] All public classes exported
- [ ] Constants exported for storage implementations
- [ ] File passes typecheck
