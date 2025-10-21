---
title: "Reference: Memory.getThreadById() "
description: "Documentation for the `Memory.getThreadById()` method in Mastra, which retrieves a specific thread by its ID."
---

# Memory.getThreadById()

The `.getThreadById()` method retrieves a specific thread by its ID.

## Usage Example

```typescript
await memory?.getThreadById({ threadId: "thread-123" });
```

## Parameters

<PropertiesTable
  content={[
    {
      name: "threadId",
      type: "string",
      description: "The ID of the thread to be retrieved.",
      isOptional: false,
    },
  ]}
/>

## Returns

<PropertiesTable
  content={[
    {
      name: "thread",
      type: "Promise<StorageThreadType | null>",
      description: "A promise that resolves to the thread associated with the given ID, or null if not found.",
    },
  ]}
/>

### Related

- [Memory Class Reference](/reference/memory/Memory.md)
- [Getting Started with Memory](/docs/memory/overview.md) (Covers threads concept)
- [createThread](/reference/memory/createThread.md)
- [getThreadsByResourceId](/reference/memory/getThreadsByResourceId.md)
