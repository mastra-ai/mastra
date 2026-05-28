# @mastra/spanner

## 1.0.0

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

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc), [`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0

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
