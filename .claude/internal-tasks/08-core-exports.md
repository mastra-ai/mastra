# Task 08: Export Inbox from Core

## Summary

Export the inbox module from the main @mastra/core package.

## File to Modify

`packages/core/src/index.ts`

## Changes Required

### Add Export

Find the exports section and add:

```typescript
// Inbox
export * from './inbox';
```

Or if selective exports are preferred:

```typescript
// Inbox
export {
  Inbox,
  InboxStorage,
  InMemoryInboxStorage,
  Task,
  TaskStatus,
  TaskPriority,
  TABLE_INBOX_TASKS,
  type IInbox,
  type CreateTaskInput,
  type ClaimFilter,
  type ListFilter,
  type InboxStats,
  type InboxConfig,
} from './inbox';
```

## Reference

Look at how other modules (agent, workflows, memory) are exported.

## Acceptance Criteria

- [ ] Inbox classes and types exported from @mastra/core
- [ ] Can import { Inbox, Task } from '@mastra/core'
- [ ] File passes typecheck
