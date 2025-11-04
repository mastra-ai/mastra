# Breaking Changes: 0.x → 1.0

This document identifies all breaking changes between the `0.x` branch and `main` branch (v1.0) across all packages and folders, including `packages/**`, `client-sdks/**`, `deployers/**`, `auth/**`, `stores/**`, and other directories.

## Table of Contents

- [@mastra/core](#mastracore)
- [@mastra/memory](#mastramemory)
- [@mastra/mcp](#mastramcp)
- [@mastra/server](#mastraserver)
- [@mastra/server & @mastra/deployer](#mastraserver--mastradeployer)
- [@mastra/cli](#mastacli)
- [@mastra/deployer](#mastradeployer)
- [@mastra/deployer-cloudflare](#mastradeployer-cloudflare)
- [Stores & Test Utils](#stores--test-utils)
- [Storage & Vector Stores](#storage--vector-stores)
- [Client SDKs](#client-sdks)
- [Voice Packages](#voice-packages)
- [Other Changes](#other-changes)

---

## @mastra/core

### 1. Main Index.ts Exports Removed

**Breaking Change:** The main `@mastra/core` index file now only exports `Mastra` and `Config`. All other exports have been moved to subpath imports.

**Before:**

```typescript
import {
  Mastra,
  Agent,
  Workflow,
  MastraStorage,
  createTool,
  // ... many other exports
} from '@mastra/core';
```

**After:**

```typescript
import { Mastra, type Config } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Workflow } from '@mastra/core/workflows';
import { MastraStorage } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
// All other exports moved to subpath imports
```

**Removed from main index:**

- All agent exports → `@mastra/core/agent`
- All workflow exports → `@mastra/core/workflows`
- All storage exports → `@mastra/core/storage`
- All tool exports → `@mastra/core/tools`
- All LLM exports → `@mastra/core/llm`
- All memory exports → `@mastra/core/memory`
- All vector exports → `@mastra/core/vector`
- All TTS exports → `@mastra/core/tts` (deprecated)
- All telemetry exports → Removed (use `@mastra/observability`)
- All eval exports → Removed (use evals API)
- All relevance exports → Removed
- All integration exports → Removed
- All hooks exports → Removed
- All utils exports → Moved to specific subpaths

**Commit:** `00f4921dd2` - `fix!: Disallow top-level @mastra/core imports (#9544)`

---

### 1.5. Top-level Imports Disallowed

**Breaking Change:** Top-level imports from `@mastra/core` are now disallowed (except for `Mastra` class).

**Before:**

```typescript
import { Mastra, MastraStorage, Agent, Workflow } from '@mastra/core';
```

**After:**

```typescript
import { Mastra } from '@mastra/core';
import { MastraStorage } from '@mastra/core/storage';
import { Agent } from '@mastra/core/agent';
import { Workflow } from '@mastra/core/workflows';
```

**Commit:** `00f4921dd2` - `fix!: Disallow top-level @mastra/core imports (#9544)`

---

### 2. Tool Signature Changed (v1.0 Format)

**Breaking Change:** All tool `execute` functions now use the new signature: `(inputData, context)` instead of `({ context, ... })`.

**Before:**

```typescript
createTool({
  execute: async ({ context, writer, tracingContext }) => {
    // context was an object with nested properties
  },
});
```

**After:**

```typescript
createTool({
  execute: async (inputData, context) => {
    // inputData is the first parameter (typed from inputSchema)
    // context is the second parameter with mastra, requestContext, tracingContext, etc.
  },
});
```

**Applies to:**

- Regular tools
- Agent tools (when agents are used as tools)
- Workflow step tools

**Commits:**

- `dff01d81ce` - `fix: update all tool signatures to v1.0 (input, context) format (#9587)`
- `c942802a47` - `Remove format from stream/generate (#9577)`

---

### 3. Workflow Step Execute Signature Changed

**Breaking Change:** Workflow step `execute` functions now receive `inputData` as the first parameter and `context` as the second.

**Before:**

```typescript
createStep({
  execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
    // inputData was wrapped in an object
  },
});
```

**After:**

```typescript
createStep({
  execute: async (inputData, context) => {
    // inputData is the first parameter (typed from inputSchema)
    // context contains: { mastra, requestContext, tracingContext, suspend, resumeData, workflow: { runId, workflowId, state, setState } }
  },
});
```

**Commit:** Changes throughout workflow implementation. See `packages/core/src/workflows/workflow.ts:315`

---

### 4. RuntimeContext → RequestContext Rename

**Breaking Change:** `RuntimeContext` has been renamed to `RequestContext` throughout the codebase.

**Before:**

```typescript
execute: async ({ runtimeContext }) => {
  // ...
};
```

**After:**

```typescript
execute: async (inputData, context) => {
  const { requestContext } = context;
  // ...
};
```

**Client SDK Utility Functions Renamed:**

- `parseClientRuntimeContext()` → `parseClientRequestContext()`
- `base64RuntimeContext()` → `base64RequestContext()`
- `runtimeContextQueryString()` → `requestContextQueryString()`

**Before:**

```typescript
import { parseClientRuntimeContext, base64RuntimeContext, runtimeContextQueryString } from '@mastra/client-js';
```

**After:**

```typescript
import { parseClientRequestContext, base64RequestContext, requestContextQueryString } from '@mastra/client-js';
```

---

### 5. Removed Workflows Legacy Export

**Breaking Change:** The `./workflows/legacy` export path has been removed from `@mastra/core`.

**Before:**

```typescript
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';
```

**After:**
Legacy workflows are no longer exported. Migrate to the new workflow API.

---

### 6. Pagination API Changed: offset/limit → page/perPage

**Breaking Change:** All pagination APIs now use `page` and `perPage` instead of `offset` and `limit`.

**Before:**

```typescript
storage.getMessagesPaginated({
  threadId: 'thread-123',
  offset: 0,
  limit: 20,
});
```

**After:**

```typescript
storage.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
});
```

**Commit:** `0633100a91` - `break: Migrate pagination from offset/limit to page/perPage (#9592)`

**Affected APIs:**

- `storage.listMessages()`
- `storage.listThreadsByResourceId()`
- `storage.listWorkflowRuns()`
- `storage.listScores()`
- `storage.listTraces()`

---

### 7. getMessagesPaginated → listMessages

**Breaking Change:** `getMessagesPaginated()` method has been replaced with `listMessages()` and now supports `perPage: false` to fetch all records.

**Before:**

```typescript
const result = await storage.getMessagesPaginated({
  threadId: 'thread-123',
  offset: 0,
  limit: 20,
});
```

**After:**

```typescript
// Paginated
const result = await storage.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
});

// Fetch all records (no pagination limit)
const allMessages = await storage.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: false, // New: fetch all records
});
```

**Additional Changes:**

- `StoragePagination.perPage` type changed from `number` to `number | false`
- HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)
- `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)
- Also applies to: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`

**Commit:** `f0a07e0111` - `feat!: Replace getMessagesPaginated with listMessages API (#9670)`

---

### 8. Removed Format Parameter from stream/generate

**Breaking Change:** The `format` parameter has been removed from `agent.stream()` and `agent.generate()` methods.

**Before:**

```typescript
agent.stream('Hello', { format: 'messages' });
```

**After:**

```typescript
agent.stream('Hello');
// Format is now determined automatically
```

**Commit:** `c942802a47` - `Remove format from stream/generate (#9577)`

---

### 9. createRunAsync → createRun

**Breaking Change:** `createRunAsync()` has been renamed to `createRun()`.

**Before:**

```typescript
await workflow.createRunAsync({ input: { ... } });
```

**After:**

```typescript
await workflow.createRun({ input: { ... } });
```

**Commit:** `f02f09b485` - `createRunAsync -> createRun (#9663)`

---

### 9.5. WorkflowRunOutput Deprecated Methods

**Breaking Change:** `pipeThrough()` and `pipeTo()` methods on `WorkflowRunOutput` are deprecated.

**Before:**

```typescript
const run = await workflow.createRun({ input: { ... } });
await run.pipeTo(writableStream);
const transformed = run.pipeThrough(transformStream);
```

**After:**

Use `fullStream` property instead:

```typescript
const run = await workflow.createRun({ input: { ... } });
await run.fullStream.pipeTo(writableStream);
const transformed = run.fullStream.pipeThrough(transformStream);
```

**Note:** The deprecated methods still work but show console warnings. They will be removed in a future version.

---

### 10. Agent Legacy Class

**Breaking Change:** Legacy Agent implementation has been moved to a separate class. The main `Agent` class now uses the new implementation.

**Commit:** `f830ce51d5` - `Agent Legacy class (#9597)`

---

### 11. Agent Constructor: Removed TMetrics Generic Parameter

**Breaking Change:** The `TMetrics` generic parameter has been removed from `AgentConfig` and `Agent` constructor.

**Before:**

```typescript
export interface AgentConfig<TAgentId, TTools, TMetrics> {
  // ...
}

const agent = new Agent<AgentId, Tools, Metrics>({
  // ...
});
```

**After:**

```typescript
export interface AgentConfig<TAgentId extends string = string, TTools extends ToolsInput = ToolsInput> {
  // ...
}

const agent = new Agent<AgentId, Tools>({
  // ...
});
```

**Note:** Metrics/scorers are now configured differently using the scorers API instead of being part of the Agent type system.

---

### 11.5. Removed Deprecated Agent Properties/Methods

**Breaking Change:** Various deprecated Agent properties and methods have been removed.

**Removed Properties:**

- `agent.llm` → Use `agent.getLLM()` instead
- `agent.tools` → Use `agent.getTools()` instead
- `agent.instructions` → Use `agent.getInstructions()` instead

**Removed Methods:**

- `agent.speak()` → Use `agent.voice.speak()` instead
- `agent.listen()` → Use `agent.voice.listen()` instead
- `agent.getSpeakers()` → Use `agent.voice.getSpeakers()` instead
- `agent.fetchMemory()` → Use `(await agent.getMemory()).query()` instead
- `agent.toStep()` → Add agent directly to workflow steps, workflows handle the transformation

**Before:**

```typescript
const llm = agent.llm;
const tools = agent.tools;
const instructions = agent.instructions;
await agent.speak('Hello');
await agent.listen();
agent.toStep();
```

**After:**

```typescript
const llm = agent.getLLM();
const tools = agent.getTools();
const instructions = agent.getInstructions();
await agent.voice.speak('Hello');
await agent.voice.listen();
// Agents can be added directly to workflows without toStep()
```

**Commit:** `d78b38d898` - `feat!(core): Remove various deprecated APIs from Agent class (#9257)`

---

### 11.2. Agent Processor Method Renames: get* → list*

**Breaking Change:** Agent processor methods have been renamed from `get*` to `list*` pattern.

**Renamed Methods:**

- `getInputProcessors()` → `listInputProcessors()`
- `getOutputProcessors()` → `listOutputProcessors()`
- `getResolvedInputProcessors()` → `listResolvedInputProcessors()` (private)
- `getResolvedOutputProcessors()` → `listResolvedOutputProcessors()` (private)

**Before:**

```typescript
const inputProcessors = await agent.getInputProcessors(runtimeContext);
const outputProcessors = await agent.getOutputProcessors(runtimeContext);
```

**After:**

```typescript
const inputProcessors = await agent.listInputProcessors(requestContext);
const outputProcessors = await agent.listOutputProcessors(requestContext);
```

**Note:** Parameter also changed from `runtimeContext` to `requestContext`.

---

### 11.5. Removed generateVNext and streamVNext Methods

**Breaking Change:** The deprecated `generateVNext()` and `streamVNext()` methods have been removed. They are now the standard `generate()` and `stream()` methods.

**Before:**

```typescript
const result = await agent.generateVNext('Hello');
const stream = await agent.streamVNext('Hello');
```

**After:**

```typescript
const result = await agent.generate('Hello');
const stream = await agent.stream('Hello');
```

**Note:** The VNext methods were previously deprecated. The standard `generate()` and `stream()` methods now use the AI SDK v5 implementation.

**Commit:** Related to `.changeset/crazy-cups-rush.md`

---

### 12. Removed Deprecated Mastra Properties

**Breaking Change:** Direct property access on Mastra instance is deprecated (though may still work with warnings).

**Deprecated (with warnings):**

- `mastra.logger` → Use `mastra.getLogger()` instead
- `mastra.storage` → Use `mastra.getStorage()` instead
- `mastra.agents` → Use `mastra.listAgents()` instead
- `mastra.tts` → Use `mastra.getTTS()` instead
- `mastra.vectors` → Use `mastra.getVectors()` instead
- `mastra.memory` → Use `mastra.getMemory()` instead

**Note:** These may still work but will show deprecation warnings. Use the getter methods instead.

---

### 13. Processors ID Required

**Breaking Change:** Processors now require an `id` field.

**Before:**

```typescript
const processor = {
  process: async input => input,
};
```

**After:**

```typescript
const processor = {
  id: 'my-processor',
  process: async input => input,
};
```

**Commit:** `d7acd8e987` - `Processors id required (#9591)`

---

### 14. Removed /model-providers API

**Breaking Change:** The `/model-providers` API endpoint has been removed from the server.

**Commit:** `0793497636` - `Remove unused /model-providers API (#9533)`

---

### 15. Renamed defaultVNextStreamOptions → defaultOptions

**Breaking Change:** `defaultVNextStreamOptions` has been renamed to `defaultOptions`.

**Commit:** `dfe3f8c737` - `Rename defaultVNextStreamOptions to defaultOptions (#9535)`

---

### 14. Watch Events API Changed

**Breaking Change:** Legacy watch events have been removed, consolidated on v2 events API.

**Before:**

```typescript
// Legacy watch events
```

**After:**

```typescript
// Use v2 events API
```

**Commit:** `a1bd7b8571` - `break: remove legacy watch events, consolidate on v2 (#9252)`

---

### 15. getThreadsByResourceId → listThreadsByResourceId

**Breaking Change:** `getThreadsByResourceId()` has been renamed to `listThreadsByResourceId()`.

**Before:**

```typescript
const threads = await storage.getThreadsByResourceId({ resourceId: 'res-123' });
```

**After:**

```typescript
const threads = await storage.listThreadsByResourceId({ resourceId: 'res-123' });
```

**Commit:** `a854ede62b` - `break: Remove getThreadsByResourceId methods in favor of listThreadsByResourceId (#9536)`

---

### 16. Removed MastraMessageV3

**Breaking Change:** `MastraMessageV3` type and related conversion methods have been removed.

**Before:**

```typescript
import type { MastraMessageV3 } from '@mastra/core/agent';
const v3Messages = messageList.get.all.v3();
```

**After:**

Use `MastraMessageV2` for storage or AI SDK v5 message formats directly:

```typescript
// For storage
const v2Messages = messageList.get.all.v2();

// For AI SDK v5
const uiMessages = messageList.get.all.aiV5.ui();
const modelMessages = messageList.get.all.aiV5.model();
```

**Commit:** `96d35f6137` - `refactor: remove MastraMessageV3 and implement direct V2 ↔ AIV5 conversions (#9094)`

---

### 17. Removed Cohere from Core

**Breaking Change:** Cohere relevance/rerank implementation has been removed from `@mastra/core`.

**Before:**

```typescript
import { cohereRerank } from '@mastra/core/relevance/cohere';
```

**After:**

Cohere functionality has been removed. Use alternative rerank solutions or external Cohere integration.

**Commit:** `c2efea174b` - `Remove cohere from core`

---

### 18. Removed Vector Prompts from RAG

**Breaking Change:** Vector prompts utilities have been removed from `@mastra/rag`.

**Before:**

```typescript
import { vectorPrompts } from '@mastra/rag/utils/vector-prompts';
```

**After:**

Vector prompts utilities have been removed. Use alternative prompt management solutions.

**Commit:** `d356f33383` - `Remove vector prompts`

---

### 19. Scorers API Changes

**Breaking Change:** Scorer APIs have been renamed and now require `id` instead of `name`.

**Changes:**

- `runExperiment()` → `runEvals()`
- `getScorerByName()` → `getScorerById()`
- Scorers now require `id` field instead of `name`
- Score APIs renamed to `listScoresBy...` pattern

**Before:**

```typescript
import { createScorer, runExperiment } from '@mastra/core/evals';

const scorer = createScorer({
  name: 'helpfulness-scorer',
  // ...
});

const scorer = mastra.getScorerByName('helpfulness-scorer');
const result = await runExperiment({ agent, scorer, inputs });
```

**After:**

```typescript
import { createScorer, runEvals } from '@mastra/core/evals';

const scorer = createScorer({
  id: 'helpfulness-scorer',
  // ...
});

const scorer = mastra.getScorerById('helpfulness-scorer');
const result = await runEvals({ agent, scorer, inputs });
```

**Storage API Changes:**

**Before:**

```typescript
const scores = await storage.getScores({ scorerName: 'helpfulness-scorer' });
```

**After:**

```typescript
const scores = await storage.listScoresByScorerId({ scorerId: 'helpfulness-scorer' });
// Also available: listScoresByRunId, listScoresByEntityId, listScoresBySpan
```

**Commit:** `fec5129de7` - `Scorers changes (#9589)`

---

### 20. Processor Interface Changes

**Breaking Change:** Processor interface has been updated with new requirements and type changes.

**Changes:**

- `name` field → `id` field (now required)
- `name` is now optional
- Message types changed from `MastraMessageV2` to `MastraDBMessage`
- `InputProcessor` and `OutputProcessor` types updated

**Before:**

```typescript
import type { InputProcessor } from '@mastra/core/processors';
import type { MastraMessageV2 } from '@mastra/core/agent';

const processor: InputProcessor = {
  name: 'my-processor',
  processInput: async ({ messages }: { messages: MastraMessageV2[] }) => {
    // ...
  },
};
```

**After:**

```typescript
import type { InputProcessor } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent';

const processor: InputProcessor = {
  id: 'my-processor',
  name: 'My Processor', // optional
  processInput: async ({ messages }: { messages: MastraDBMessage[] }) => {
    // ...
  },
};
```

**Commit:** Related to processor refactoring and `173c535c06` - `break(core): remove deprecated input-processor exports (#9200)`

---

### 21. Removed Deprecated Input Processor Exports

**Breaking Change:** Deprecated input-processor exports have been removed from `@mastra/core`.

**Removed:**

- Old input processor exports from `@mastra/core/processors`

**Before:**

```typescript
import { InputProcessor } from '@mastra/core/processors'; // old exports
```

**After:**

Use the new `Processor` interface:

```typescript
import type { Processor, InputProcessor } from '@mastra/core/processors';
```

**Commit:** `173c535c06` - `break(core): remove deprecated input-processor exports (#9200)`

---

### 22. getWorkflowRuns → listWorkflowRuns

**Breaking Change:** `getWorkflowRuns()` has been renamed to `listWorkflowRuns()`.

**Before:**

```typescript
const runs = await workflow.getWorkflowRuns({ fromDate, toDate });
```

**After:**

```typescript
const runs = await workflow.listWorkflowRuns({ fromDate, toDate });
```

**Commit:** `3443770662` - `Update handlers for getWorkflowRuns to listWorkflowRuns and fix types (#9507)`

---

### 23. Removed `output` and `experimental_output` Options, Use `structuredOutput` Instead

**Breaking Change:** The deprecated `output` and `experimental_output` options have been removed from agent stream/generate methods.

**Before:**

```typescript
agent.stream('Hello', {
  output: z.object({ result: z.string() }),
  // or
  experimental_output: z.object({ result: z.string() }),
});
```

**After:**

```typescript
agent.stream('Hello', {
  structuredOutput: {
    schema: z.object({ result: z.string() }),
  },
});
```

**Note:** `experimental_output` was used for structured output that worked with tools. Use `structuredOutput` instead, which provides the same functionality.

**Commit:** Related to `.changeset/crazy-cups-rush.md`

---

### 24. Removed `modelSettings.abortSignal`

**Breaking Change:** `modelSettings.abortSignal` has been removed. Use top-level `abortSignal` instead.

**Before:**

```typescript
agent.stream('Hello', {
  modelSettings: {
    abortSignal: abortController.signal,
  },
});
```

**After:**

```typescript
agent.stream('Hello', {
  abortSignal: abortController.signal,
});
```

**Commit:** Related to `.changeset/crazy-cups-rush.md`

---

### 25. Default Options Method Renames

**Breaking Change:** Default options methods have been renamed to clarify legacy vs new APIs.

**Before:**

```typescript
const options = await agent.getDefaultGenerateOptions();
const streamOptions = await agent.getDefaultStreamOptions();
```

**After:**

```typescript
// For legacy AI SDK v4
const options = await agent.getDefaultGenerateOptionsLegacy();
const streamOptions = await agent.getDefaultStreamOptionsLegacy();

// For new AI SDK v5 (default)
const streamOptions = await agent.getDefaultStreamOptions();
```

**Note:** `getDefaultGenerateOptions()` and `getDefaultStreamOptions()` have been renamed to `...Legacy()` versions. The new default methods use AI SDK v5.

**Commit:** Related to `.changeset/crazy-cups-rush.md`

---

### 26. Removed Watch-Related Types from Client SDK

**Breaking Change:** Watch-related types have been removed from `@mastra/client-js`.

**Removed:**

- Watch event types from client SDK
- Watch-related types from playground

**Before:**

```typescript
import type { WorkflowWatchResult, WatchEvent } from '@mastra/client-js';
```

**After:**

Watch functionality has been removed. Use workflow events API instead.

**Commit:** `2261fb3e32` - `removed watch related types from client-sdk and playground`

---

### 27. createLogger Deprecated

**Breaking Change:** `createLogger()` function has been deprecated.

**Before:**

```typescript
import { createLogger } from '@mastra/core/logger';

const logger = createLogger({ name: 'MyApp', level: 'debug' });
```

**After:**

```typescript
import { ConsoleLogger } from '@mastra/core/logger';

const logger = new ConsoleLogger({ name: 'MyApp', level: 'debug' });
```

**Note:** `createLogger()` still works but shows deprecation warnings.

---

### 28. Removed Type Exports

**Breaking Change:** Several type exports have been removed from `@mastra/core`.

**Removed Types:**

- `DeprecatedOutputOptions<OUTPUT>` - Removed from agent types
- `WorkflowWatchResult` - Removed with watch API (replaced with workflow events)
- `AlgoliaSearchOptions` - Removed Algolia search types
- `AlgoliaResult` - Removed Algolia search types
- `MastraCloudExporterOptions` - Removed with telemetry
- `MastraMessageV3` - Removed message format (use V2 or AI SDK v5)
- `WhenConditionReturnValue` enum - Removed
- Processor option types (now internal):
  - `LanguageDetectorOptions`
  - `ModerationOptions`
  - `PIIDetectorOptions`
  - `PromptInjectionOptions`
  - `UnicodeNormalizerOptions`

**Type Renames:**

- `GetWorkflowRunsResponse` → `ListWorkflowRunsResponse`
- `GetMemoryThreadResponse` → `ListMemoryThreadsResponse`
- `GetMemoryThreadMessagesPaginatedParams` → `ListMemoryThreadMessagesParams`
- `GetMemoryThreadMessagesPaginatedResponse` → `ListMemoryThreadMessagesResponse`
- `MastraMessageV2` → `MastraDBMessage` (in most contexts)
- `SaveMessageToMemoryResponse` - Changed from `(MastraMessageV1 | MastraMessageV2)[]` to `(MastraMessageV1 | MastraDBMessage)[]`

**Before:**

```typescript
import type {
  DeprecatedOutputOptions,
  WorkflowWatchResult,
  AlgoliaSearchOptions,
  MastraMessageV2,
  GetWorkflowRunsResponse,
} from '@mastra/core';
```

**After:**

```typescript
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ListWorkflowRunsResponse } from '@mastra/client-js';
// Other types removed or moved to internal packages
```

**Commit:** Related to various removals and renames throughout codebase

---

### 29. Removed Utility Files and Functions

**Breaking Change:** Several utility files and functions have been removed.

**Removed Utility Files:**

- `packages/core/src/ai-tracing/utils.ts` - Moved to observability
- `packages/core/src/telemetry/utility.ts` - Removed with telemetry
- `packages/core/src/workflows/legacy/utils.ts` - Removed with legacy workflows
- `packages/rag/src/utils/vector-prompts.ts` - Removed vector prompts feature
- `packages/cloud/src/utils/fetchWithRetry.ts` - Removed utility
- `packages/core/src/loop/test-utils/mockTracer.ts` - Removed test utility
- `packages/core/src/loop/test-utils/telemetry.ts` - Removed test utility
- Various trace-related utility files in playground-ui

**Removed Error Domain:**

- `ErrorDomain.MASTRA_TELEMETRY` - Removed from error domain enum

**Note:** If you were importing from these utility files, you'll need to find alternative implementations or update your code to use the new APIs.

---

## @mastra/server & @mastra/deployer

### 1. API Endpoint Handler Renames: get* → list*

**Breaking Change:** All API endpoint handlers have been renamed from `get*` to `list*` pattern.

**Renamed Endpoints:**

- `GET /api/agents` → Handler renamed: `getAgentsHandler` → `listAgentsHandler`
- `GET /api/memory/threads` → Handler renamed: `getThreadsHandler` → `listThreadsHandler`
- `GET /api/memory/threads/:threadId/messages` → Handler renamed: `getMessagesPaginatedHandler` → `listMessagesHandler`
- `GET /api/scorers` → Handler renamed: `getScorersHandler` → `listScorersHandler`
- `GET /api/scores` → Handlers renamed: `getScoresByRunIdHandler` → `listScoresByRunIdHandler`, etc.
- `GET /api/tools` → Handler renamed: `getToolsHandler` → `listToolsHandler`
- `GET /api/workflows` → Handler renamed: `getWorkflowsHandler` → `listWorkflowsHandler`
- `GET /api/workflows/:workflowId/runs` → Handler renamed: `getWorkflowRunsHandler` → `listWorkflowRunsHandler`
- `GET /api/logs` → Handler renamed: `getLogsHandler` → `listLogsHandler`
- `GET /api/logs/:runId` → Handler renamed: `getLogsByRunIdHandler` → `listLogsByRunIdHandler`

**Note:** This affects server-side handler implementations. Client SDKs have been updated accordingly.

**Commits:** Multiple commits throughout the codebase

---

### 2. Removed API Endpoints

**Breaking Change:** Several API endpoints have been removed.

**Removed Endpoints:**

- `GET /api/model-providers` - Model providers API removed
- `GET /api/workflows/:workflowId/watch` - Watch endpoint removed (use events API)
- `GET /api/agent-builder/:actionId/watch` - Watch endpoint removed
- `POST /api/agents/:agentId/stream/vnext` - Deprecated, returns 410 Gone
- `POST /api/agents/:agentId/stream/ui` - Deprecated
- `/api/memory/network/*` - Network memory APIs removed

**Before:**

```typescript
// Client calls
const providers = await fetch('/api/model-providers');
const watchResult = await fetch('/api/workflows/workflow-123/watch');
const networkThread = await fetch('/api/memory/network/threads/thread-123');
```

**After:**

```typescript
// Model providers removed - use model router API instead
// Watch endpoints removed - use workflow events API instead
// Network memory APIs removed - use regular memory APIs
```

**Commits:**

- `dfe3f8c737` - `Remove unused /model-providers API (#9533)`
- `7cadb3e3ef` - `Remove network memory apis`
- Related to watch events removal

---

### 3. Deprecated Stream Endpoints

**Breaking Change:** Some stream endpoints are deprecated and will be removed.

**Deprecated:**

- `POST /api/agents/:agentId/stream/vnext` - Returns 410 Gone
- `POST /api/agents/:agentId/stream/ui` - Deprecated (use `@mastra/ai-sdk` package)

**Before:**

```typescript
const response = await fetch('/api/agents/my-agent/stream/vnext', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] }),
});
```

**After:**

```typescript
// Use standard stream endpoint
const response = await fetch('/api/agents/my-agent/stream', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] }),
});

// Or use @mastra/ai-sdk for UI message transformations
```

**Commits:** Related to stream endpoint consolidation

---

## @mastra/memory

### 1. Required Configuration: storage, vector, embedder

**Breaking Change:** `storage`, `vector`, and `embedder` are now required parameters (no defaults).

**Before:**

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  // storage, vector, embedder were optional with defaults
});
```

**After:**

```typescript
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';

const memory = new Memory({
  storage: new LibSQLStore({ url: 'file:./mastra.db' }),
  vector: new LibSQLVector({ url: 'file:./mastra.db' }),
  embedder: fastembed,
});
```

**Commit:** `0dcb9f0` - Memory breaking changes

---

### 2. Working Memory: text-stream Removed

**Breaking Change:** Working memory `use: "text-stream"` option has been removed. Only `tool-call` mode is supported.

**Before:**

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      use: 'text-stream', // ❌ No longer supported
      template: '...',
    },
  },
});
```

**After:**

```typescript
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      // use is no longer needed - defaults to tool-call
      template: '...',
    },
  },
});
```

**Commit:** `0dcb9f0` - Memory breaking changes

---

### 3. Default Settings Changed

**Breaking Change:** Default settings have changed to more reasonable values.

**Before (implicit defaults):**

```typescript
{
  lastMessages: 40,
  semanticRecall: { topK: 2, messageRange: 2, scope: "thread" }, // enabled by default, thread scope
  threads: {
    generateTitle: true, // enabled by default
  },
}
```

**After (new defaults):**

```typescript
{
  lastMessages: 10,
  semanticRecall: false, // must be explicitly enabled (defaults to "resource" scope when enabled)
  threads: {
    generateTitle: false, // disabled by default
  },
}
```

**Commits:**

- `0dcb9f0` - Memory breaking changes
- `ebac15564a` - `feat!: change default memory scope from 'thread' to 'resource' (#8983)`
- `c7f1f7d24f` - `feat!: change generateTitle default to false (#9045)`
- `245820cdea` - `feat!(@mastra/memory): optimize semantic recall default settings (#9046)`

**Note:** When `semanticRecall` is enabled, it now defaults to `"resource"` scope instead of `"thread"` scope.

---

### 4. Memory.query() Return Format Changed

**Breaking Change:** `Memory.query()` now returns a simpler format.

**Before:**

```typescript
const result = await memory.query({ threadId: 'thread-123' });
// result: { messages: CoreMessage[], uiMessages: UIMessageWithMetadata[], messagesV2: MastraMessageV2[] }
```

**After:**

```typescript
const result = await memory.query({ threadId: 'thread-123' });
// result: { messages: MastraDBMessage[] }
```

**Commit:** `0bddc6d8db` - `feat!: memory return format (#9255)`

---

### 5. Memory.query() Parameter Changes

**Breaking Change:** `Memory.query()` now uses `StorageListMessagesInput` format with pagination.

**Before:**

```typescript
memory.query({
  threadId: "thread-123",
  selectBy: { ... }
});
```

**After:**

```typescript
memory.query({
  threadId: "thread-123",
  page: 0,
  perPage: 20,
  orderBy: "createdAt",
  filter: { ... }
});
```

---

### 6. Memory Processors Config Deprecated

**Breaking Change:** The `processors` config option in Memory constructor has been deprecated and now throws an error.

**Before:**

```typescript
const memory = new Memory({
  storage,
  vector,
  embedder,
  processors: [
    /* ... */
  ], // This was allowed
});
```

**After:**

Processors should be configured at the Agent level, not Memory level:

```typescript
const memory = new Memory({
  storage,
  vector,
  embedder,
  // processors removed - configure at Agent level instead
});

const agent = new Agent({
  memory,
  processors: [
    /* ... */
  ], // Configure processors here
});
```

**Note:** Using `processors` in Memory config will throw an error with a clear migration message.

**Commit:** `5e91e33286` - `feat(memory): add deprecation error for processors config`

---

## @mastra/mcp

### 1. Removed Deprecated MCP Client

**Breaking Change:** `MastraMCPClient` and related deprecated APIs have been removed.

**Before:**

```typescript
import { MastraMCPClient } from '@mastra/mcp/client';
import { MCPConfiguration } from '@mastra/mcp/client';
```

**After:**

```typescript
import { MCPClient } from '@mastra/mcp/client';
// Use new MCPClient API
```

**Removed:**

- `MastraMCPClient` class
- `MCPConfiguration` class
- `MCPConfigurationOptions` type
- Legacy `getResources()` method

**Commit:** `85436efc35` - `feat!(mcp): remove remaining deprecated mcp items (#9669)`

---

## @mastra/server

### 1. Playground → Studio Rename

**Breaking Change:** Playground has been renamed to Studio.

**Commit:** `a926ec7296` - `paul/grwth-896-rename-playground-to-studio-1.x (#9656)`

---

## @mastra/cli

### 1. Removed CLI Flags and Options

**Breaking Change:** Several CLI flags and options have been removed.

**Removed:**

- `-y` / `--yes` option from CLI commands
- `--env` flag from `mastra build` command
- `--port` flag from `mastra dev` command

**Before:**

```bash
mastra build --env production
mastra dev --port 3001
mastra init -y
```

**After:**

```bash
# Use server.port in Mastra config instead of --port flag
# Use mastra start --env <env> instead of build --env
# Remove -y flag, CLI will prompt interactively
mastra build
mastra dev  # port configured in Mastra instance
mastra init  # no -y flag
```

**Commits:**

- `d7e63e39ab` - `remove -y option (1.0) (#9607)`
- Related to `--env` and `--port` flag removals

---

### 2. Removed Telemetry Option from CLI

**Breaking Change:** The `telemetry` option has been removed from CLI commands.

**Removed:**

- `--no-telemetry` / `-nt` flag from `mastra dev` command
- `telemetry` parameter from `startProject()` function
- Telemetry-related CLI files (`telemetry-loader.ts`, `telemetry-resolver.ts`)
- `writeTelemetryConfig()` function from deployer

**Before:**

```bash
mastra dev --no-telemetry
```

```typescript
await startProject({ dir: '.', telemetry: false });
```

**After:**

Telemetry has been removed from CLI. Use `@mastra/observability` for tracing features if needed.

**Note:** Telemetry/OpenTelemetry integration has been completely removed from the CLI and core packages.

---

## @mastra/deployer

### 1. Removed Deploy Command

**Breaking Change:** The `mastra deploy` command has been removed from deployers.

**Before:**

```bash
mastra deploy
```

**After:**
Use vendor-specific deployment tools directly (e.g., `vercel deploy`, `netlify deploy`).

---

## @mastra/deployer-cloudflare

### 1. Removed CloudflareDeployer Properties

**Breaking Change:** `CloudflareDeployer` constructor parameters and properties have been removed.

**Removed:**

- `scope` property and constructor parameter
- `auth` parameter from constructor
- Private `cloudflare` client property
- `tagWorker()` method now throws an error directing users to Cloudflare dashboard

**Before:**

```typescript
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

const deployer = new CloudflareDeployer({
  scope: 'my-scope',
  auth: { apiToken: '...' },
});
await deployer.tagWorker('worker-name', 'tag');
```

**After:**

Use Cloudflare dashboard or API directly for operations that previously required the cloudflare client.

**Commit:** `d83392d` - Remove scope, auth, and cloudflare client from CloudflareDeployer

---

## Stores & Test Utils

### 1. Removed Evals Test Utils

**Breaking Change:** Evals domain test utilities have been removed from `@internal/test-utils`.

**Removed Files:**

- `stores/_test-utils/src/domains/evals/data.ts`
- `stores/_test-utils/src/domains/evals/index.ts`

**Before:**

```typescript
import { createEvalsTests } from '@internal/test-utils/domains/evals';

createEvalsTests({ storage });
```

**After:**

Evals test utilities have been removed. Use storage APIs directly for testing.

**Commit:** `ed67dfe1ef` - `Part 1: Remove legacy evals (#9366)`

---

### 2. Removed TABLE_EVALS from MSSQL Storage

**Breaking Change:** The `TABLE_EVALS` table has been removed from MSSQL storage implementations.

**Impact:** MSSQL storage adapters no longer support the evals table. If you were using MSSQL storage with evals, you'll need to migrate to a different storage adapter or remove evals functionality.

**Commit:** `7b04567dbf` - `Remove TABLE_EVALS from mssql`

---

## Storage & Vector Stores

### 1. Vector Store API: Positional → Named Arguments

**Breaking Change:** All vector store methods now use named arguments instead of positional arguments.

**Before:**

```typescript
await vectorDB.createIndex(indexName, 3, 'cosine');
await vectorDB.upsert(indexName, [[1, 2, 3]], [{ test: 'data' }]);
await vectorDB.query(indexName, [1, 2, 3], 5);
await vectorDB.updateIndexById(indexName, id, update);
```

**After:**

```typescript
await vectorDB.createIndex({
  indexName: indexName,
  dimension: 3,
  metric: 'cosine',
});

await vectorDB.upsert({
  indexName: indexName,
  vectors: [[1, 2, 3]],
  metadata: [{ test: 'data' }],
});

await vectorDB.query({
  indexName: indexName,
  queryVector: [1, 2, 3],
  topK: 5,
});

await vectorDB.updateVector({
  indexName: indexName,
  id: id,
  update: update,
});
```

**Commit:** `a7292b0` - Vector store breaking changes

---

### 2. Vector Store Method Renames

**Breaking Change:** `updateIndexById` and `deleteIndexById` have been renamed.

**Before:**

```typescript
await vectorDB.updateIndexById(indexName, id, update);
await vectorDB.deleteIndexById(indexName, id);
```

**After:**

```typescript
await vectorDB.updateVector({ indexName, id, update });
await vectorDB.deleteVector({ indexName, id });
```

---

### 3. PGVector Constructor Changes

**Breaking Change:** PGVector constructor now requires object parameters instead of a connection string.

**Before:**

```typescript
const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
```

**After:**

```typescript
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});
```

---

### 4. PGVector: defineIndex → buildIndex

**Breaking Change:** `defineIndex()` method has been removed, use `buildIndex()` instead.

**Before:**

```typescript
await vectorDB.defineIndex(indexName, 'cosine', { type: 'flat' });
```

**After:**

```typescript
await vectorDB.buildIndex({
  indexName: indexName,
  metric: 'cosine',
  indexConfig: { type: 'flat' },
});
```

---

### 5. PostgresStore: schema → schemaName

**Breaking Change:** `schema` parameter renamed to `schemaName` in PostgresStore constructor.

**Before:**

```typescript
const pgStore = new PostgresStore({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schema: customSchema,
});
```

**After:**

```typescript
const pgStore = new PostgresStore({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schemaName: customSchema,
});
```

---

## Storage & Vector Stores (More Changes)

### 6. Storage getMessages and saveMessages Signature Changes

**Breaking Change:** `getMessages()` and `saveMessages()` methods have changed signatures and return types. Format overloads have been removed.

**Before:**

```typescript
// Format overloads removed
const v1Messages = await storage.getMessages({ threadId, format: 'v1' });
const v2Messages = await storage.getMessages({ threadId, format: 'v2' });
const messagesById = await storage.getMessagesById({ messageIds: ['msg-1'], format: 'v1' });

// SaveMessages had format overloads
await storage.saveMessages({ messages: v1Messages, format: 'v1' });
await storage.saveMessages({ messages: v2Messages, format: 'v2' });
```

**After:**

```typescript
// Always returns { messages: MastraDBMessage[] }
const result = await storage.getMessages({ threadId });
const messages = result.messages; // MastraDBMessage[]

// SaveMessages always uses MastraDBMessage
const result = await storage.saveMessages({ messages: mastraDBMessages });
const saved = result.messages; // MastraDBMessage[]
```

**Changes:**

- Removed format overloads (`'v1'` | `'v2'`)
- `getMessages()` now always returns `{ messages: MastraDBMessage[] }`
- `saveMessages()` now always accepts and returns `MastraDBMessage[]`
- Format parameter completely removed
- `getMessagesById()` format overloads also removed

**Commit:** Related to format parameter removal throughout codebase

---

### 7. Removed getTraces and getTracesPaginated

**Breaking Change:** `getTraces()` and `getTracesPaginated()` methods have been removed from storage.

**Before:**

```typescript
const traces = await storage.getTraces({ traceId: 'trace-123' });
const paginated = await storage.getTracesPaginated({ page: 0, perPage: 20 });
```

**After:**

Use observability storage methods instead:

```typescript
// Use observability API for traces
import { initObservability } from '@mastra/observability';
const observability = initObservability({ config: { ... } });
// Access traces through observability API
```

**Note:** Traces are now handled through the observability package rather than core storage.

---

### 8. Removed Non-Paginated Storage Functions

**Breaking Change:** Non-paginated storage functions have been removed in favor of paginated versions.

**Removed:**

- Non-paginated versions of storage methods
- Direct access methods that bypass pagination

**Before:**

```typescript
// Non-paginated direct access
const messages = await storage.getMessages({ threadId });
```

**After:**

```typescript
// Use paginated methods
const result = await storage.listMessages({ threadId, page: 0, perPage: 20 });
// Or fetch all
const allMessages = await storage.listMessages({ threadId, page: 0, perPage: false });
```

**Note:** `getMessages()` still exists but now returns `{ messages: MastraDBMessage[] }` wrapper. For pagination, use `listMessages()`.

**Commit:** `c56ea077b1` - `remove non paginated storage functions`

---

## Client SDKs

### 1. Removed toAISdkFormat Function

**Breaking Change:** `toAISdkFormat()` function has been removed from `@mastra/ai-sdk`.

**Before:**

```typescript
import { toAISdkFormat } from '@mastra/ai-sdk';

const stream = toAISdkFormat(agentStream, { from: 'agent' });
```

**After:**

```typescript
import { toAISdkStream } from '@mastra/ai-sdk';

const stream = toAISdkStream(agentStream, { from: 'agent' });
```

**Note:** `toAISdkFormat()` now throws an error directing users to use `toAISdkStream()` instead.

---

### 2. Removed Network Memory Methods

**Breaking Change:** Network memory methods have been removed from `@mastra/client-js`.

**Removed:**

- `NetworkMemoryThread` class
- Network memory-related methods from client SDK

**Before:**

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: '...' });
const networkThread = client.networkMemory.getThread('thread-id');
```

**After:**

Network memory functionality has been removed. Use regular memory APIs instead.

**Commit:** `5e6782d17d` - `Remove network methods from client-js`

---

### 3. Client SDK Type Renames: Get* → List*

**Breaking Change:** Client SDK types have been renamed from `Get*` to `List*` pattern.

**Renamed Types:**

- `GetWorkflowRunsParams` → `ListWorkflowRunsParams`
- `GetWorkflowRunsResponse` → `ListWorkflowRunsResponse`
- `GetMemoryThreadParams` → `ListMemoryThreadsParams`
- `GetMemoryThreadResponse` → `ListMemoryThreadsResponse`
- `GetMemoryThreadMessagesPaginatedParams` → `ListMemoryThreadMessagesParams`
- `GetMemoryThreadMessagesPaginatedResponse` → `ListMemoryThreadMessagesResponse`
- `GetScoresByRunIdParams` → `ListScoresByRunIdParams`
- `GetScoresByScorerIdParams` → `ListScoresByScorerIdParams`
- `GetScoresByEntityIdParams` → `ListScoresByEntityIdParams`
- `GetScoresBySpanParams` → `ListScoresBySpanParams`
- `GetScoresResponse` → `ListScoresResponse`

**Removed Types:**

- `GetEvalsByAgentIdResponse`
- `GetTelemetryResponse`
- `GetTelemetryParams`
- `WorkflowWatchResult`
- `CreateNetworkMemoryThreadParams`
- `GetNetworkMemoryThreadParams`

**Before:**

```typescript
import type { GetWorkflowRunsParams, GetWorkflowRunsResponse } from '@mastra/client-js';
```

**After:**

```typescript
import type { ListWorkflowRunsParams, ListWorkflowRunsResponse } from '@mastra/client-js';
```

---

### 4. Removed experimental_generateMessageId

**Breaking Change:** `experimental_generateMessageId` option has been removed from agent generate/stream methods.

**Before:**

```typescript
agent.generate('Hello', {
  experimental_generateMessageId: () => 'custom-id',
});
```

**After:**

Message IDs are now automatically generated. If you need custom ID generation, configure it at the Memory level:

```typescript
const memory = new Memory({
  // generateMessageId is handled internally
});
```

---

### 5. Pagination Parameter Changes

**Breaking Change:** All client SDK methods that used `offset`/`limit` now use `page`/`perPage`.

**Before:**

```typescript
client.memory.getMessagesPaginated({
  threadId: 'thread-123',
  offset: 0,
  limit: 20,
});
```

**After:**

```typescript
client.memory.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
});
```

---

### 2. Removed NetworkMemoryThread Class

**Breaking Change:** The `NetworkMemoryThread` class has been removed from `@mastra/client-js`.

**Before:**

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: '...' });
const networkThread = client.memory.networkThread('thread-id', 'network-id');
await networkThread.get();
await networkThread.getMessages();
await networkThread.deleteMessages(['msg-1', 'msg-2']);
```

**After:**

Network memory thread functionality has been removed. Use regular memory thread APIs instead.

**Commit:** File deleted in `client-sdks/client-js/src/resources/network-memory-thread.ts`

---

### 3. getMessagesById → listMessagesById

**Breaking Change:** `getMessagesById()` has been renamed to `listMessagesById()` in storage adapters.

**Before:**

```typescript
const result = await storage.getMessagesById({ messageIds: ['msg-1', 'msg-2'] });
```

**After:**

```typescript
const result = await storage.listMessagesById({ messageIds: ['msg-1', 'msg-2'] });
```

**Commit:** `3defc80cf2` - `Remove getMessagesById in favor of listMessagesById (#9534)`

---

## Voice Packages

### 1. Package Renames: @mastra/speech-_ → @mastra/voice-_

**Breaking Change:** Speech packages have been renamed to voice packages with API changes.

**Affected Packages:**

- `@mastra/speech-murf` → `@mastra/voice-murf`
- `@mastra/speech-speechify` → `@mastra/voice-speechify`
- `@mastra/speech-playai` → `@mastra/voice-playai`

**API Changes:**

- `MurfTTS` / `SpeechifyTTS` / `PlayAITTS` → `MurfVoice` / `SpeechifyVoice` / `PlayAIVoice`
- `generate()` and `stream()` methods → Combined into `speak()`
- `voices()` method → `getSpeakers()`
- Constructor configuration simplified

**Before:**

```typescript
import { MurfTTS } from '@mastra/speech-murf';

const tts = new MurfTTS({ apiKey: '...' });
await tts.generate('Hello');
const voices = await tts.voices();
```

**After:**

```typescript
import { MurfVoice } from '@mastra/voice-murf';

const voice = new MurfVoice({ apiKey: '...' });
await voice.speak('Hello');
const speakers = await voice.getSpeakers();
```

**Commits:** Multiple commits deprecating speech packages in favor of voice packages

---

## Other Changes

### 1. Environment Variable Naming: Hyphens → Underscores

**Breaking Change:** Provider environment variable names now use underscores instead of hyphens.

**Before:**

```bash
# Provider ID: github-copilot
GITHUB-COPILOT_API_KEY=...
GITHUB-COPILOT_BASE_URL=...
```

**After:**

```bash
# Provider ID: github-copilot (still kebab-case)
GITHUB_COPILOT_API_KEY=...
GITHUB_COPILOT_BASE_URL=...
```

**Note:** Provider IDs remain in kebab-case, but environment variables use snake_case (converting hyphens to underscores).

**Commit:** `685b7fcefa` - `fix(core): convert hyphens to underscores in provider env var names`

---

### 2. Removed Docker Compose Starter Files

**Breaking Change:** Docker Compose configuration files have been removed from CLI starter files.

**Removed:**

- `mastra-pg.docker-compose.yaml` from starter files
- Related configuration in `packages/cli/src/starter-files/config.ts`

**Before:**

```bash
mastra init
# Included docker-compose.yaml files
```

**After:**

Docker Compose files are no longer included in starter templates. Users need to create their own Docker setup if needed.

**Commit:** `719c875914` - `feat: remove deprecated configuration and Docker Compose files for cleaner project structure`

---

### 3. Experimental Auth → Auth

**Breaking Change:** Experimental auth has been promoted to stable auth.

**Commit:** `16153fe7eb` - `Experimental auth -> auth (#9660)`

---

### 2. AI Tracing Moved to @mastra/observability

**Breaking Change:** AI tracing implementations have been moved to `@mastra/observability`.

**Before:**

```typescript
// AI tracing was in @mastra/core
```

**After:**

```typescript
import { ... } from "@mastra/observability";
```

**Commit:** `a0c8c1b87d` - `move ai-tracing implementations to @mastra/observability (#9661)`

---

### 3. FastEmbed Package Created

**Breaking Change:** Default embedder has been moved to `@mastra/fastembed` package.

**Before:**

```typescript
// FastEmbed was included in @mastra/core or @mastra/memory
```

**After:**

```typescript
import { fastembed } from '@mastra/fastembed';
```

**Commit:** Related to memory breaking changes

---

### 4. Removed Old Tracing Code and OpenTelemetry

**Breaking Change:** Old tracing code and OpenTelemetry integration have been removed from `@mastra/core`.

**Removed:**

- Old tracing/telemetry implementations
- OpenTelemetry integration from core
- Telemetry-related CLI commands and utilities

**Before:**

```typescript
// Old tracing/telemetry code in @mastra/core
```

**After:**

Use `@mastra/observability` for tracing and observability features.

**Removed Exports:**

- `MastraCloudExporter` class from `@mastra/core/telemetry`
- `MastraCloudExporterOptions` type
- `TelemetrySettings` type from `ai` package imports
- `Metric` type from eval imports

**Commit:** `f0f8f125c3` - `Removed all old tracing code and OpenTelemetry (#9237)`

---

### 5. Legacy Evals Removed

**Breaking Change:** Legacy evals code has been removed from `@mastra/core`.

**Removed:**

- Legacy evaluation metrics
- Legacy scorer/judge modules
- Hook-based automatic evaluation code

**Before:**

```typescript
// Legacy evals APIs
```

**After:**

Use the new evals/scorers API in `@mastra/core` or `@mastra/evals`.

**Commit:** `ed67dfe1ef` - `Part 1: Remove legacy evals (#9366)`

---

### 6. runCount → retryCount (Deprecated)

**Breaking Change:** `runCount` parameter has been deprecated in favor of `retryCount` in workflow step execution.

**Before:**

```typescript
createStep({
  execute: async ({ runCount }) => {
    console.log(`Step run ${runCount} times`);
  },
});
```

**After:**

```typescript
createStep({
  execute: async ({ retryCount }) => {
    console.log(`Step retry count: ${retryCount}`);
  },
});
```

**Note:** `runCount` still works but shows deprecation warnings. It will be removed on November 4th, 2025.

**Commit:** `6c049d9406` - `Rename runCount to retryCount (#9153)`

---

## Summary by Impact

### High Impact (Requires Code Changes)

1. Tool signature changes (affects all tools)
2. Workflow step execute signature changes
3. Memory API changes (required config, defaults, scope changes)
4. Pagination API changes (throughout codebase)
5. Vector store API changes (positional → named args)
6. Top-level import restrictions
7. Removed Agent deprecated properties/methods

### Medium Impact (May Require Updates)

1. RuntimeContext → RequestContext rename
2. Method renames (getMessagesPaginated → listMessages, etc.)
3. MCP client API changes
4. Format parameter removal
5. Memory scope default change (thread → resource)
6. Deprecated Mastra properties (with warnings)

### Low Impact (Minor Updates)

1. createRunAsync → createRun
2. defaultVNextStreamOptions → defaultOptions
3. Playground → Studio rename
4. Processors id requirement

---

## Migration Checklist

- [ ] Update all tool `execute` signatures to `(inputData, context)` format
- [ ] Update workflow step `execute` signatures
- [ ] Replace top-level `@mastra/core` imports with subpath imports
- [ ] Update all pagination calls from `offset/limit` to `page/perPage`
- [ ] Replace `getMessagesPaginated` with `listMessages`
- [ ] Update Memory configuration to include required `storage`, `vector`, `embedder`
- [ ] Update Memory default settings if relying on old defaults
- [ ] Update vector store calls to use named arguments
- [ ] Rename `updateIndexById`/`deleteIndexById` to `updateVector`/`deleteVector`
- [ ] Update PGVector constructor calls
- [ ] Replace `defineIndex` with `buildIndex` for PGVector
- [ ] Update PostgresStore `schema` to `schemaName`
- [ ] Migrate from deprecated MCP client to new API
- [ ] Remove `format` parameter from `stream()`/`generate()` calls
- [ ] Update `createRunAsync` to `createRun`
- [ ] Add `id` to all processors
- [ ] Update `RuntimeContext` references to `RequestContext`
- [ ] Replace `agent.llm`, `agent.tools`, `agent.instructions` with getter methods
- [ ] Replace `agent.speak()`, `agent.listen()`, `agent.getSpeakers()` with `agent.voice.*` methods
- [ ] Replace `agent.fetchMemory()` with `(await agent.getMemory()).query()`
- [ ] Remove `agent.toStep()` calls (agents can be added directly to workflows)
- [ ] Update Memory semantic recall scope if relying on default "thread" scope
- [ ] Replace `getMessagesById` with `listMessagesById` in storage adapters
- [ ] Remove `NetworkMemoryThread` usage from client-js (if used)
- [ ] Update CloudflareDeployer initialization (remove scope/auth parameters)
- [ ] Replace `runCount` with `retryCount` in workflow step execution (before Nov 4, 2025)
- [ ] Migrate from `@mastra/speech-*` to `@mastra/voice-*` packages if using voice features
- [ ] Update voice API calls (`generate()`/`stream()` → `speak()`, `voices()` → `getSpeakers()`)
- [ ] Migrate from old tracing/telemetry to `@mastra/observability` if using tracing
- [ ] Remove legacy evals code if using old eval APIs
- [ ] Replace `MastraMessageV3` usage with `MastraMessageV2` or AI SDK v5 formats
- [ ] Update scorers: `runExperiment` → `runEvals`, `getScorerByName` → `getScorerById`
- [ ] Update scorer config: `name` → `id` (required)
- [ ] Update score storage APIs to `listScoresBy...` methods
- [ ] Update processors: `name` → `id` (required), update message types to `MastraDBMessage`
- [ ] Replace `getWorkflowRuns` with `listWorkflowRuns`
- [ ] Replace `output` and `experimental_output` options with `structuredOutput.schema` in agent calls
- [ ] Move `modelSettings.abortSignal` to top-level `abortSignal` parameter
- [ ] Replace `toAISdkFormat()` with `toAISdkStream()` in AI SDK integration code
- [ ] Remove network memory methods from client SDK code
- [ ] Update client SDK types: `Get*` → `List*` pattern
- [ ] Remove `experimental_generateMessageId` from agent calls
- [ ] Update `getDefaultGenerateOptions`/`getDefaultStreamOptions` to `...Legacy()` if using AI SDK v4
- [ ] Update agent processor methods: `getInputProcessors` → `listInputProcessors`, `getOutputProcessors` → `listOutputProcessors`
- [ ] Remove format parameter from `storage.getMessages()` and `storage.saveMessages()`
- [ ] Update `storage.getMessages()` to handle `{ messages: MastraDBMessage[] }` return format
- [ ] Replace `storage.getTraces()`/`getTracesPaginated()` with observability API
- [ ] Remove `waitForEvent` API usage if present
- [ ] Replace `createLogger()` with `new ConsoleLogger()`
- [ ] Remove watch-related types from client SDK code (if used)
- [ ] Remove Cohere relevance/rerank usage from core (if used)
- [ ] Remove vector prompts usage from RAG (if used)
- [ ] Remove `-y`, `--env`, `--port` CLI flags from scripts
- [ ] Update main `@mastra/core` imports to use subpath imports (only `Mastra` and `Config` from main index)
- [ ] Remove `MastraCloudExporterOptions`, `DeprecatedOutputOptions`, `WorkflowWatchResult` type references
- [ ] Remove `AlgoliaSearchOptions`/`AlgoliaResult` if using Algolia search
- [ ] Update processor option types if using language detection, moderation, PII detection, or prompt injection
- [ ] Install `@mastra/fastembed` if using default embedder
- [ ] Install `@mastra/libsql` if using default storage/vector
- [ ] Install `@mastra/loggers` if using Pino logger
- [ ] Update environment variable names: convert hyphens to underscores (e.g., `GITHUB-COPILOT_API_KEY` → `GITHUB_COPILOT_API_KEY`)
- [ ] Remove `processors` config from Memory constructor (move to Agent level)
- [ ] Remove Docker Compose references if using starter files

---

## Additional Notes

- Many of these changes are documented in individual package CHANGELOGs
- Some changes may have deprecation warnings in 0.x versions
- Check migration guides in the docs for more detailed examples
- Test thoroughly after migration, especially around:
  - Tool execution
  - Workflow execution
  - Memory queries
  - Pagination behavior
  - Vector store operations
