# Task 07: Mastra Inbox Integration

## Summary

Add inbox support to the Mastra class - config, getInbox(), listInboxes(), addTask().

## File to Modify

`packages/core/src/mastra/index.ts`

## Changes Required

### 1. Update Config Interface

Find the Config interface and add inboxes:

```typescript
export interface Config<
  TAgents,
  TWorkflows,
  TVectors,
  // ... existing generics
  TInboxes extends Record<string, Inbox> = Record<string, Inbox>, // ADD
> {
  // ... existing properties ...

  inboxes?: TInboxes; // ADD
}
```

### 2. Add Private Field

```typescript
class Mastra {
  // ... existing fields ...

  #inboxes: Map<string, Inbox> = new Map();
}
```

### 3. Update Constructor

Register inboxes and inject Mastra reference:

```typescript
constructor(config: Config<...>) {
  // ... existing code ...

  // Register inboxes
  if (config.inboxes) {
    for (const [key, inbox] of Object.entries(config.inboxes)) {
      inbox.__registerMastra(this);
      this.#inboxes.set(inbox.id, inbox);
    }
  }
}
```

### 4. Add Methods

```typescript
/**
 * Get an inbox by ID.
 */
getInbox(id: string): Inbox | undefined {
  return this.#inboxes.get(id);
}

/**
 * Get an inbox by ID, throwing if not found.
 */
getInboxOrThrow(id: string): Inbox {
  const inbox = this.#inboxes.get(id);
  if (!inbox) {
    throw new MastraError({
      id: 'INBOX_NOT_FOUND',
      domain: ErrorDomain.MASTRA,
      category: ErrorCategory.USER,
      text: `Inbox '${id}' not found`,
    });
  }
  return inbox;
}

/**
 * List all registered inboxes.
 */
listInboxes(): Inbox[] {
  return Array.from(this.#inboxes.values());
}

/**
 * Add a task to an inbox.
 */
async addTask(
  inboxId: string,
  input: CreateTaskInput
): Promise<Task> {
  const inbox = this.getInboxOrThrow(inboxId);
  return inbox.add(input);
}
```

### 5. Add Imports

```typescript
import { Inbox, type CreateTaskInput, type Task } from '../inbox';
```

## Reference

Look at how agents are registered and accessed in the same file.

## Acceptance Criteria

- [ ] Inboxes config added to Config interface
- [ ] Inboxes stored in private Map
- [ ] \_\_registerMastra called on each inbox
- [ ] getInbox(), getInboxOrThrow(), listInboxes() methods work
- [ ] addTask() convenience method works
- [ ] File passes typecheck
