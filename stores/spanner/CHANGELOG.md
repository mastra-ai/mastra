# @mastra/spanner

## 2.0.0-alpha.0

### Major Changes

- Added a Google Cloud Spanner storage adapter (`@mastra/spanner`) targeting the GoogleSQL dialect. The adapter implements the `memory`, `workflows`, `scores`, `backgroundTasks`, `agents`, `mcpClients`, `mcpServers`, `skills`, `blobs`, `promptBlocks`, `scorerDefinitions`, `schedules`, and `observability` storage domains and works with both managed Cloud Spanner instances and the local Spanner emulator. The `schedules` domain plugs into Mastra's built-in `WorkflowScheduler` for cron-driven workflow triggers, and the `observability` domain persists AI tracing spans in `mastra_ai_spans` to power the Studio traces UI (JSON containment filters compile to per-key `JSON_VALUE` equality and `EXISTS` over `JSON_QUERY_ARRAY` since Spanner has no `@>` operator). ([#15955](https://github.com/mastra-ai/mastra/pull/15955))

  ```typescript
  import { SpannerStore } from '@mastra/spanner';

  const storage = new SpannerStore({
    id: 'spanner-storage',
    projectId: process.env.SPANNER_PROJECT_ID!,
    instanceId: process.env.SPANNER_INSTANCE_ID!,
    databaseId: process.env.SPANNER_DATABASE_ID!,
  });
  ```

### Patch Changes

- Updated dependencies [[`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0-alpha.6

## 1.0.0

### Major Changes

- Initial stable release of the Google Cloud Spanner storage adapter for Mastra. Supports the GoogleSQL dialect with full storage-domain parity: `memory`, `workflows`, `scores`, `backgroundTasks`, `agents`, `mcpClients`, `mcpServers`, `skills`, `blobs`, `promptBlocks`, `scorerDefinitions`, `schedules` (cron-driven workflow triggers consumed by `WorkflowScheduler`), and `observability` (AI tracing spans persisted in `mastra_ai_spans` with the full trace read/write surface). Works against managed Spanner instances and the local Spanner emulator.
