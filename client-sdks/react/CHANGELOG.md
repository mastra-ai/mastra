# @mastra/react

## 0.2.7-alpha.0

### Patch Changes

- Added completionResult to MastraUIMessageMetadata ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

- Updated dependencies:
  - @mastra/client-js@1.7.1-alpha.0

## 0.2.6

### Patch Changes

- Updated dependencies [[`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc)]:
  - @mastra/client-js@1.7.0

## 0.2.6-alpha.0

### Patch Changes

- Updated dependencies [[`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc)]:
  - @mastra/client-js@1.7.0-alpha.0

## 0.2.5

### Patch Changes

- dependencies updates: ([#13308](https://github.com/mastra-ai/mastra/pull/13308))
  - Updated dependency [`tailwind-merge@^3.4.1` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.4.1) (from `^3.3.1`, in `dependencies`)
- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251)]:
  - @mastra/client-js@1.6.0

## 0.2.5-alpha.0

### Patch Changes

- dependencies updates: ([#13308](https://github.com/mastra-ai/mastra/pull/13308))
  - Updated dependency [`tailwind-merge@^3.4.1` ↗︎](https://www.npmjs.com/package/tailwind-merge/v/3.4.1) (from `^3.3.1`, in `dependencies`)
- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`3f8f1b3`](https://github.com/mastra-ai/mastra/commit/3f8f1b31146d2a8316157171962ad825628aa251)]:
  - @mastra/client-js@1.6.0-alpha.0

## 0.2.4

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed tool error results displaying as "[object Object]" during streaming in the chat UI. Error messages are now properly extracted and displayed. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9)]:
  - @mastra/client-js@1.5.0

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.5.0-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed tool error results displaying as "[object Object]" during streaming in the chat UI. Error messages are now properly extracted and displayed. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`55a0ab1`](https://github.com/mastra-ai/mastra/commit/55a0ab13187b3c656247a1d9bfa715077af6e422), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9)]:
  - @mastra/client-js@1.5.0-alpha.0

## 0.2.3

### Patch Changes

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Updated dependencies [[`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5)]:
  - @mastra/client-js@1.4.0

## 0.2.3-alpha.0

### Patch Changes

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Updated dependencies [[`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`3da8a73`](https://github.com/mastra-ai/mastra/commit/3da8a73c9b9f042d528975ca330babc99563bd12), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`4ba40dc`](https://github.com/mastra-ai/mastra/commit/4ba40dcb6c9ef31eedbb01b6d5b8b0b3c71e5b61), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`40f224e`](https://github.com/mastra-ai/mastra/commit/40f224ec14e9b01a36802d8c5445a547a33992a5)]:
  - @mastra/client-js@1.4.0-alpha.0

## 0.2.2

### Patch Changes

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Updated dependencies [[`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133)]:
  - @mastra/client-js@1.3.0

## 0.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211)]:
  - @mastra/client-js@1.3.0-alpha.3

## 0.2.2-alpha.2

### Patch Changes

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/client-js@1.3.0-alpha.2

## 0.2.2-alpha.1

### Patch Changes

- Fixed chat messages flashing when loading a thread. Messages now update reactively via useEffect instead of lazy state initialization, preventing the brief flash of empty state. ([#12863](https://github.com/mastra-ai/mastra/pull/12863))

- Updated dependencies [[`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`be42958`](https://github.com/mastra-ai/mastra/commit/be42958d62c9f3d6b3a037580a6ef362afa47240), [`a211248`](https://github.com/mastra-ai/mastra/commit/a21124845b1b1321b6075a8377c341c7f5cda1b6), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133)]:
  - @mastra/client-js@1.3.0-alpha.1

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/client-js@1.2.1-alpha.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275)]:
  - @mastra/client-js@1.2.0

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0)]:
  - @mastra/client-js@1.2.0-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275)]:
  - @mastra/client-js@1.1.1-alpha.0

## 0.2.0

### Minor Changes

- Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes (defaults to `/api`). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  **Default usage (no change required):**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000">{children}</MastraClientProvider>
  ```

  **Custom prefix usage:**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
    {children}
  </MastraClientProvider>
  ```

  See #12261 for more details.

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

### Patch Changes

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Updated dependencies [[`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334)]:
  - @mastra/client-js@1.1.0

## 0.2.0-alpha.2

### Patch Changes

- Updated dependencies [[`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334), [`a64a24c`](https://github.com/mastra-ai/mastra/commit/a64a24c9bce499b989667c7963f2f71a11d90334)]:
  - @mastra/client-js@1.1.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Updated dependencies [[`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f)]:
  - @mastra/client-js@1.1.0-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes (defaults to `/api`). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  **Default usage (no change required):**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000">{children}</MastraClientProvider>
  ```

  **Custom prefix usage:**

  ```tsx
  <MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
    {children}
  </MastraClientProvider>
  ```

  See #12261 for more details.

- Added useCancelWorkflowRun hook to @mastra/react for canceling workflow runs. This hook was previously only available internally in playground-ui and is now exported for use in custom applications. ([#12142](https://github.com/mastra-ai/mastra/pull/12142))

- Added useStreamWorkflow hook to @mastra/react for streaming workflow execution. This hook supports streaming, observing, resuming, and time-traveling workflows. It accepts tracingOptions and onError as parameters for better customization. ([#12151](https://github.com/mastra-ai/mastra/pull/12151))

### Patch Changes

- Use useExecuteWorkflow hook from @mastra/react instead of local implementation in playground-ui ([#12138](https://github.com/mastra-ai/mastra/pull/12138))

- Updated dependencies [[`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`dc82e6c`](https://github.com/mastra-ai/mastra/commit/dc82e6c5a05d6a9160c522af08b8c809ddbcdb66)]:
  - @mastra/client-js@1.1.0-alpha.0

## 0.1.1

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.1

## 0.1.1-alpha.0

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.1-alpha.0

## 0.1.0

### Minor Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- **Fixed:** Align `Agent.network` with core and update `@mastra/react` network usage. ([#12015](https://github.com/mastra-ai/mastra/pull/12015))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate([...], {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate([...], {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Adjust the types to accept tracingOptions ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fix TypeScript errors during build declaration generation ([#11682](https://github.com/mastra-ai/mastra/pull/11682))

  Updated test file `toUIMessage.test.ts` to match current `@mastra/core` types:
  - Changed `error` property from string to `Error` object (per `StepFailure` type)
  - Added missing `resumeSchema` property to `tool-call-approval` payloads (per `ToolCallApprovalPayload` type)
  - Added `zod` as peer/dev dependency for test type support

- Fix text parts incorrectly merging across tool calls ([#11783](https://github.com/mastra-ai/mastra/pull/11783))

  Previously, when an agent produced text before and after a tool call (e.g., "Let me search for that" → tool call → "Here's what I found"), the text parts would be merged into a single part, losing the separation. This fix introduces a `textId` property to track separate text streams, ensuring each text stream maintains its own text part in the UI message.

  Fixes #11577

- Configurable resourceId in react useChat ([#10461](https://github.com/mastra-ai/mastra/pull/10461))

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension. ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Fixed compatibility with updated `@mastra/client-js` generate and stream API signatures ([#12011](https://github.com/mastra-ai/mastra/pull/12011))

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- Fix multi modal in react sdk ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility
- Updated dependencies [[`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f), [`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5)]:
  - @mastra/client-js@1.0.0

## 0.1.0-beta.27

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.27

## 0.1.0-beta.26

### Patch Changes

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac)]:
  - @mastra/client-js@1.0.0-beta.26

## 0.1.0-beta.25

### Minor Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

### Patch Changes

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/client-js@1.0.0-beta.25

## 0.1.0-beta.23

### Major Changes

- **Fixed:** Align `Agent.network` with core and update `@mastra/react` network usage. ([#12015](https://github.com/mastra-ai/mastra/pull/12015))

### Patch Changes

- Fixed compatibility with updated `@mastra/client-js` generate and stream API signatures ([#12011](https://github.com/mastra-ai/mastra/pull/12011))

- Updated dependencies [[`461e448`](https://github.com/mastra-ai/mastra/commit/461e448852fe999506a6046d50b1efc27d8aa378)]:
  - @mastra/client-js@1.0.0-beta.24

## 0.1.0-beta.23

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.23

## 0.1.0-beta.22

### Patch Changes

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate({
    messages: [...],
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate({
    messages: [...],
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fix text parts incorrectly merging across tool calls ([#11783](https://github.com/mastra-ai/mastra/pull/11783))

  Previously, when an agent produced text before and after a tool call (e.g., "Let me search for that" → tool call → "Here's what I found"), the text parts would be merged into a single part, losing the separation. This fix introduces a `textId` property to track separate text streams, ensuring each text stream maintains its own text part in the UI message.

  Fixes #11577

- Updated dependencies [[`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151)]:
  - @mastra/client-js@1.0.0-beta.22

## 0.1.0-beta.21

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.21

## 0.1.0-beta.20

### Patch Changes

- Fix TypeScript errors during build declaration generation ([#11682](https://github.com/mastra-ai/mastra/pull/11682))

  Updated test file `toUIMessage.test.ts` to match current `@mastra/core` types:
  - Changed `error` property from string to `Error` object (per `StepFailure` type)
  - Added missing `resumeSchema` property to `tool-call-approval` payloads (per `ToolCallApprovalPayload` type)
  - Added `zod` as peer/dev dependency for test type support

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Updated dependencies [[`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5)]:
  - @mastra/client-js@1.0.0-beta.20

## 0.1.0-beta.19

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.19

## 0.1.0-beta.18

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.18

## 0.1.0-beta.17

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.17

## 0.1.0-beta.16

### Patch Changes

- Updated dependencies [[`6cbb549`](https://github.com/mastra-ai/mastra/commit/6cbb549475201a2fbf158f0fd7323f6495f46d08)]:
  - @mastra/client-js@1.0.0-beta.16

## 0.1.0-beta.15

### Minor Changes

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

### Patch Changes

- Updated dependencies [[`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb)]:
  - @mastra/client-js@1.0.0-beta.15

## 0.1.0-beta.14

### Patch Changes

- Updated dependencies [[`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/client-js@1.0.0-beta.14

## 0.1.0-beta.13

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.13

## 0.1.0-beta.12

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Updated dependencies [[`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce)]:
  - @mastra/client-js@1.0.0-beta.12

## 0.1.0-beta.11

### Patch Changes

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript showLineNumbers copy
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Updated dependencies [[`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/client-js@1.0.0-beta.11

## 0.1.0-beta.10

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Updated dependencies [[`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d)]:
  - @mastra/client-js@1.0.0-beta.10

## 0.1.0-beta.9

### Patch Changes

- Updated dependencies [[`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4)]:
  - @mastra/client-js@1.0.0-beta.9

## 0.1.0-beta.8

### Patch Changes

- Updated dependencies:
  - @mastra/client-js@1.0.0-beta.8

## 0.1.0-beta.7

### Patch Changes

- Updated dependencies [[`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141)]:
  - @mastra/client-js@1.0.0-beta.7

## 0.1.0-beta.6

### Patch Changes

- Adjust the types to accept tracingOptions ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

- Updated dependencies [[`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d)]:
  - @mastra/client-js@1.0.0-beta.6

## 0.1.0-beta.5

### Patch Changes

- Configurable resourceId in react useChat ([#10461](https://github.com/mastra-ai/mastra/pull/10461))

- fix(agent): persist messages before tool suspension ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Updated dependencies [[`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f)]:
  - @mastra/client-js@1.0.0-beta.5

## 0.1.0-beta.4

### Patch Changes

- Updated dependencies [[`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440)]:
  - @mastra/client-js@1.0.0-beta.4

## 0.1.0-beta.3

### Patch Changes

- Updated dependencies [[`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365)]:
  - @mastra/client-js@1.0.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@1.0.0-beta.2

## 0.1.0-beta.1

### Patch Changes

- Updated dependencies [[`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f)]:
  - @mastra/client-js@1.0.0-beta.1

## 0.1.0-beta.0

### Minor Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

### Patch Changes

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix multi modal in react sdk ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Updated dependencies [[`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014)]:
  - @mastra/client-js@1.0.0-beta.0

## 0.0.10

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4

## 0.0.10-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.4-alpha.0

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3

## 0.0.9-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.3-alpha.0

## 0.0.8

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2

## 0.0.8-alpha.1

### Patch Changes

- Fix perf issue: removed flush sync ([#9014](https://github.com/mastra-ai/mastra/pull/9014))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.1

## 0.0.8-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.2-alpha.0

## 0.0.7

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1

## 0.0.7-alpha.0

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies []:
  - @mastra/client-js@0.16.1-alpha.0

## 0.0.6

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0

## 0.0.6-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.4

## 0.0.6-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.3

## 0.0.6-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.2

## 0.0.6-alpha.1

### Patch Changes

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Move react and react-dom deps to peer and dev deps ([#8698](https://github.com/mastra-ai/mastra/pull/8698))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Updated dependencies []:
  - @mastra/client-js@0.16.0-alpha.1

## 0.0.6-alpha.0

### Patch Changes

- Gracefully fix errors in react-sdk when error is an object ([#8703](https://github.com/mastra-ai/mastra/pull/8703))

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Updated dependencies [[`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87)]:
  - @mastra/client-js@0.16.0-alpha.0

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2

## 0.0.5-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.2-alpha.0

## 0.0.4

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1

## 0.0.4-alpha.4

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.4

## 0.0.4-alpha.3

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.3

## 0.0.4-alpha.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.2

## 0.0.4-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- Updated dependencies [[`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa)]:
  - @mastra/client-js@0.15.1-alpha.1

## 0.0.4-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.15.1-alpha.0

## 0.0.3

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0

## 0.0.3-alpha.0

### Patch Changes

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Updated dependencies [[`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/client-js@0.15.0-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1

## 0.0.2-alpha.1

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies []:
  - @mastra/client-js@0.14.1-alpha.0

## 0.0.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0

## 0.0.1-alpha.1

### Patch Changes

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30)]:
  - @mastra/client-js@0.14.0-alpha.1

## 0.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67)]:
  - @mastra/client-js@0.14.0-alpha.0
