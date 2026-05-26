# @mastra/spanner

## 1.0.0-alpha.0

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

- Updated dependencies [[`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9)]:
  - @mastra/core@1.37.0-alpha.8
