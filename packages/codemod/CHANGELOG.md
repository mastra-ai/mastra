# @mastra/codemod

## 0.1.0-beta.7

### Patch Changes

- Add new `v1/client-msg-function-args` codemod. It transforms MastraClient agent method calls to use messages as the first argument. ([#12061](https://github.com/mastra-ai/mastra/pull/12061))

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

## 0.1.0-beta.6

### Patch Changes

- Remove incorrect codemod ([#11826](https://github.com/mastra-ai/mastra/pull/11826))

## 0.1.0-beta.5

### Patch Changes

- **Breaking Change:** `memory.readOnly` has been moved to `memory.options.readOnly` ([#11523](https://github.com/mastra-ai/mastra/pull/11523))

  The `readOnly` option now lives inside `memory.options` alongside other memory configuration like `lastMessages` and `semanticRecall`.

  **Before:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      readOnly: true,
    },
  });
  ```

  **After:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      options: {
        readOnly: true,
      },
    },
  });
  ```

  **Migration:** Run the codemod to update your code automatically:

  ```shell
  npx @mastra/codemod@beta v1/memory-readonly-to-options .
  ```

  This also fixes issue #11519 where `readOnly: true` was being ignored and messages were saved to memory anyway.

## 0.1.0-beta.4

### Patch Changes

- Fixed a bug where `[native code]` was incorrectly added to the output ([#10971](https://github.com/mastra-ai/mastra/pull/10971))

## 0.1.0-beta.3

### Patch Changes

- Add `v1/workflow-stream-vnext` codemod. This codemod renames `streamVNext()`, `resumeStreamVNext()`, and `observeStreamVNext()` to their "non-VNext" counterparts. ([#10802](https://github.com/mastra-ai/mastra/pull/10802))

## 0.1.0-beta.2

### Patch Changes

- Fix `mastra-required-id`, `mcp-get-toolsets`, and `mcp-get-tools` codemods to add missing imports and instances. ([#10221](https://github.com/mastra-ai/mastra/pull/10221))

## 0.1.0-beta.1

### Patch Changes

- - Improve existing codemods ([#9959](https://github.com/mastra-ai/mastra/pull/9959))
  - Make package ESM-only
  - Add new codemods

## 0.1.0-beta.0

### Minor Changes

- Initial release of `@mastra/codemod` package ([#9579](https://github.com/mastra-ai/mastra/pull/9579))
