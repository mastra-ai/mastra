# Task 02: Create Inbox Constants

## Summary

Create constants for the inbox storage schema.

## File to Create

`packages/core/src/inbox/constants.ts`

## Constants to Define

### Table Name

```typescript
export const TABLE_INBOX_TASKS = 'mastra_inbox_tasks';
```

### Schema Definition

```typescript
import type { StorageColumn } from '../storage/types';

export const INBOX_TASKS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  inbox_id: { type: 'text', nullable: false },
  type: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  priority: { type: 'integer', nullable: false },

  // Display
  title: { type: 'text', nullable: true },
  source_id: { type: 'text', nullable: true },
  source_url: { type: 'text', nullable: true },

  // Data
  payload: { type: 'jsonb', nullable: false },
  result: { type: 'jsonb', nullable: true },
  error: { type: 'jsonb', nullable: true },

  // Assignment
  target_agent_id: { type: 'text', nullable: true },
  claimed_by: { type: 'text', nullable: true },

  // Timing
  created_at: { type: 'timestamp', nullable: false },
  claimed_at: { type: 'timestamp', nullable: true },
  started_at: { type: 'timestamp', nullable: true },
  completed_at: { type: 'timestamp', nullable: true },

  // Retries
  attempts: { type: 'integer', nullable: false },
  max_attempts: { type: 'integer', nullable: false },

  // Metadata
  metadata: { type: 'jsonb', nullable: true },
};
```

### Default Values

```typescript
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_PRIORITY = 1; // NORMAL
```

## Reference

Look at existing schema definitions in:

- `packages/core/src/storage/constants.ts`

## Acceptance Criteria

- [ ] Table name follows Mastra naming convention (mastra\_\*)
- [ ] Schema matches Task interface field names (snake_case for DB)
- [ ] All required fields are marked nullable: false
- [ ] File passes typecheck
