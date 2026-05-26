---
'@mastra/spanner': major
---

Added a Google Cloud Spanner storage adapter (`@mastra/spanner`) targeting the GoogleSQL dialect. The adapter implements the `memory`, `workflows`, `scores`, `backgroundTasks`, `agents`, `mcpClients`, `mcpServers`, `skills`, `blobs`, `promptBlocks`, `scorerDefinitions`, `schedules`, and `observability` storage domains and works with both managed Cloud Spanner instances and the local Spanner emulator. The `schedules` domain plugs into Mastra's built-in `WorkflowScheduler` for cron-driven workflow triggers, and the `observability` domain persists AI tracing spans in `mastra_ai_spans` to power the Studio traces UI (JSON containment filters compile to per-key `JSON_VALUE` equality and `EXISTS` over `JSON_QUERY_ARRAY` since Spanner has no `@>` operator).

```typescript
import { SpannerStore } from '@mastra/spanner';

const storage = new SpannerStore({
  id: 'spanner-storage',
  projectId: process.env.SPANNER_PROJECT_ID!,
  instanceId: process.env.SPANNER_INSTANCE_ID!,
  databaseId: process.env.SPANNER_DATABASE_ID!,
});
```
