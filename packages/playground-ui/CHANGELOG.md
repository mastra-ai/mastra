# @mastra/playground-ui

## 7.0.0-beta.15

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

- Add Mastra version footer component that displays installed packages and checks npm registry for available updates and deprecation warnings ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Fix clicking nested workflows in sidepanel: resolve runtime error when clicking "View Nested Graph" inside an already-open nested workflow panel, and ensure the graph updates when switching between nested workflows. ([#11391](https://github.com/mastra-ai/mastra/pull/11391))

- Add resizable and collapsible side panels for agents and workflows ([#11371](https://github.com/mastra-ai/mastra/pull/11371))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`184f01d`](https://github.com/mastra-ai/mastra/commit/184f01d1f534ec0be9703d3996f2e088b4a560eb), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/core@1.0.0-beta.15
  - @mastra/ai-sdk@1.0.0-beta.11
  - @mastra/client-js@1.0.0-beta.15
  - @mastra/react@0.1.0-beta.15

## 7.0.0-beta.14

### Patch Changes

- Change searchbar to search on input with debounce instead of on Enter key press ([#11138](https://github.com/mastra-ai/mastra/pull/11138))

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`b7b0930`](https://github.com/mastra-ai/mastra/commit/b7b0930dbe72eade8d3882992f2f2db53220e4eb), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14
  - @mastra/ai-sdk@1.0.0-beta.10
  - @mastra/client-js@1.0.0-beta.14
  - @mastra/react@0.1.0-beta.14

## 7.0.0-beta.13

### Patch Changes

- Updated dependencies [[`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497)]:
  - @mastra/core@1.0.0-beta.13
  - @mastra/client-js@1.0.0-beta.13
  - @mastra/react@0.1.0-beta.13

## 7.0.0-beta.12

### Patch Changes

- Adds tool/workflow error being surfaced to the side panel in the playground ([#11099](https://github.com/mastra-ai/mastra/pull/11099))

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

- Fix trace-span-usage component to handle object values in token usage data. Usage objects can contain nested `inputDetails` and `outputDetails` properties which are objects, not numbers. The component now properly type-checks values and renders object properties as nested key-value pairs. ([#11141](https://github.com/mastra-ai/mastra/pull/11141))

- Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods. ([#11207](https://github.com/mastra-ai/mastra/pull/11207))
  With this change, run methods cannot be called directly on workflow instance anymore

  ```diff
  - const result = await workflow.stream({ runId: '123', inputData: { ... } });
  + const run = await workflow.createRun({ runId: '123' });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server) ([#11074](https://github.com/mastra-ai/mastra/pull/11074))

  Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

  Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`

- Focus the textarea when clicking anywhere in the entire chat prompt input box ([#11160](https://github.com/mastra-ai/mastra/pull/11160))

- Removes redundant "Working Memory" section from memory config panel (already displayed in dedicated working memory component) ([#11104](https://github.com/mastra-ai/mastra/pull/11104))
  Fixes badge rendering for falsy values by using ?? instead of || (e.g., false was incorrectly displayed as empty string)
  Adds tooltip on disabled "Edit Working Memory" button explaining that working memory becomes available after the agent calls updateWorkingMemory

- Workflow step detail panel improvements ([#11134](https://github.com/mastra-ai/mastra/pull/11134))
  - Add step detail panel to view map configs and nested workflows from the workflow graph
  - Enable line wrapping for code display in map config panel and WHEN condition nodes
  - Auto-switch to "Current Run" tab when opening step details
  - Add colored icons matching workflow graph (orange for map, purple for workflow)
  - Simplify step detail context by removing unused parent stack navigation

- Fix agent default settings not being applied in playground ([#11107](https://github.com/mastra-ai/mastra/pull/11107))
  - Fix settings hook to properly merge agent default options with localStorage values
  - Map `maxOutputTokens` (AI SDK v5) to `maxTokens` for UI compatibility
  - Add `seed` parameter support to model settings
  - Add frequency/presence penalty inputs with sliders
  - Extract and apply agent's `defaultOptions.modelSettings` on load

- fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string) ([#11083](https://github.com/mastra-ai/mastra/pull/11083))

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`1b85674`](https://github.com/mastra-ai/mastra/commit/1b85674123708d9b85834dccc9eae601a9d0891c), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`439eaf7`](https://github.com/mastra-ai/mastra/commit/439eaf75447809b05e326666675a4dcbf9c334ce), [`b98d9a0`](https://github.com/mastra-ai/mastra/commit/b98d9a02e1a4381a4faf65b7371fe76978a42d2e), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`55ae5af`](https://github.com/mastra-ai/mastra/commit/55ae5afa0a59d777e519825171cef9d73f02992e)]:
  - @mastra/core@1.0.0-beta.12
  - @mastra/react@0.1.0-beta.12
  - @mastra/schema-compat@1.0.0-beta.3
  - @mastra/client-js@1.0.0-beta.12
  - @mastra/ai-sdk@1.0.0-beta.9

## 7.0.0-beta.11

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

- Updated dependencies [[`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0-beta.11
  - @mastra/client-js@1.0.0-beta.11
  - @mastra/ai-sdk@1.0.0-beta.8
  - @mastra/react@0.1.0-beta.11

## 7.0.0-beta.10

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Remove console.log in playground-ui ([#11004](https://github.com/mastra-ai/mastra/pull/11004))

- Use the hash based stringification mechanism of tanstack query to ensure keys ordering (and to keep the caching key valid and consistent) ([#11008](https://github.com/mastra-ai/mastra/pull/11008))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add the possibility to pass down options to the tanstack query client. Goal is to have cacheable request in cloud and it's not possible for now because of context resolution beeing different ([#11026](https://github.com/mastra-ai/mastra/pull/11026))

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`151fe4d`](https://github.com/mastra-ai/mastra/commit/151fe4dd441c8ee038c628a3b9bbece7caf9b406), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10
  - @mastra/client-js@1.0.0-beta.10
  - @mastra/react@0.1.0-beta.10
  - @mastra/ai-sdk@1.0.0-beta.7

## 7.0.0-beta.9

### Patch Changes

- Fix default value showing on workflow form after user submits ([#10983](https://github.com/mastra-ai/mastra/pull/10983))

- Move useScorers down to trace page to trigger it once for all trace spans ([#10985](https://github.com/mastra-ai/mastra/pull/10985))

- Update Observability Trace Spans list UI, so a user can expand/collapse span children/descendants and can filter the list by span type or name ([#10378](https://github.com/mastra-ai/mastra/pull/10378))

- Add UI to match with the mastra studio command ([#10283](https://github.com/mastra-ai/mastra/pull/10283))

- Fix workflow trigger form overflow ([#10986](https://github.com/mastra-ai/mastra/pull/10986))

- Updated dependencies [[`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`a54793a`](https://github.com/mastra-ai/mastra/commit/a54793a6377edb87d43a795711deedf487152d5c), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`5a1ede1`](https://github.com/mastra-ai/mastra/commit/5a1ede1f7ab527b9ead11f7eee2f73e67aeca9e4), [`92a2ab4`](https://github.com/mastra-ai/mastra/commit/92a2ab408a21d7f88f8db111838bc247069c2ee9), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3)]:
  - @mastra/core@1.0.0-beta.9
  - @mastra/ai-sdk@1.0.0-beta.7
  - @mastra/client-js@1.0.0-beta.9
  - @mastra/react@0.1.0-beta.9

## 7.0.0-beta.8

### Patch Changes

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`3d3c9e7`](https://github.com/mastra-ai/mastra/commit/3d3c9e7dc0b7b291abe6a11cf3807dd130034961), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8
  - @mastra/ai-sdk@1.0.0-beta.6
  - @mastra/client-js@1.0.0-beta.8
  - @mastra/react@0.1.0-beta.8

## 7.0.0-beta.7

### Patch Changes

- Add StudioConfig and associated context to manage the headers and base URL of a given Mastra instance. ([#10804](https://github.com/mastra-ai/mastra/pull/10804))

  This also introduces a header form available from the side bar to edit those headers.

- Fix select options overflow when list is long by adding maximum height ([#10813](https://github.com/mastra-ai/mastra/pull/10813))

- Removed uneeded calls to the message endpoint when the user is on a new thread ([#10872](https://github.com/mastra-ai/mastra/pull/10872))

- Add prominent warning banner in observability UI when token limits are exceeded (finishReason: 'length'). ([#10835](https://github.com/mastra-ai/mastra/pull/10835))

  When a model stops generating due to token limits, the span details now display:
  - Clear warning with alert icon
  - Detailed token usage breakdown (input + output = total)
  - Explanation that the response was truncated

  This helps developers quickly identify and debug token limit issues in the observation page.

  Fixes #8828

- Add a specific page for the studio settings and moved the headers configuration form here instead of in a dialog ([#10812](https://github.com/mastra-ai/mastra/pull/10812))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7
  - @mastra/client-js@1.0.0-beta.7
  - @mastra/react@0.1.0-beta.7

## 7.0.0-beta.6

### Patch Changes

- Fix wrong hook arg type when retrieving workflow runs ([#10755](https://github.com/mastra-ai/mastra/pull/10755))

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Hide time travel on map steps in Studio ([#10631](https://github.com/mastra-ai/mastra/pull/10631))

- Added tracing options to workflow runs and agent generate / stream / network. You can now configure tracing options, custom request context keys, and parent trace/span IDs through a new "Tracing options" tab in the workflow/agent ui UI. ([#10742](https://github.com/mastra-ai/mastra/pull/10742))

  **Usage:**

  The workflow settings are now accessible via the new `useTracingSettings` hook and `TracingSettingsProvider`:

  ```tsx
  import { TracingSettingsProvider, useWorkflowSettings } from '@mastra/playground-ui';

  // Wrap your workflow components with the provider
  <TracingSettingsProvider entityId="my-workflow" entityType="workflow">
    <YourWorkflowUI />
  </TracingSettingsProvider>;

  // Access settings in child components
  const { settings, setSettings } = useTracingSettings();

  // Configure tracing options
  setSettings({
    tracingOptions: {
      metadata: { userId: '123' },
      requestContextKeys: ['user.email'],
      traceId: 'abc123',
    },
  });
  ```

  Tracing options are persisted per workflow/agent in localStorage and automatically applied to all workflow/agent executions.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`6edf340`](https://github.com/mastra-ai/mastra/commit/6edf3402f6a46ee8def2f42a2287785251fbffd6), [`17b4b46`](https://github.com/mastra-ai/mastra/commit/17b4b46339898f13f52c4c4e3d16c52630629c29), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`91c3a61`](https://github.com/mastra-ai/mastra/commit/91c3a61c533b348a18ba4394069efff26ac7d5a7), [`ad7e8f1`](https://github.com/mastra-ai/mastra/commit/ad7e8f16ac843cbd16687ad47b66ba96bcffe111), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e1b7118`](https://github.com/mastra-ai/mastra/commit/e1b7118f42ca0a97247afc75e57dcd5fdf987752), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`441c7b6`](https://github.com/mastra-ai/mastra/commit/441c7b6665915cfa7fd625fded8c0f518530bf10), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`e24d4c0`](https://github.com/mastra-ai/mastra/commit/e24d4c0e8a340c47cfa901ebe299cb9ed6c699b4), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6
  - @mastra/client-js@1.0.0-beta.6
  - @mastra/ai-sdk@1.0.0-beta.5
  - @mastra/react@0.1.0-beta.6
  - @mastra/schema-compat@1.0.0-beta.2

## 7.0.0-beta.5

### Patch Changes

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

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

- Fixed "Module not found: Can't resolve '@mastra/ai-sdk/ui'" error when playground-ui is used on Cloud by converting @mastra/ai-sdk to a peer dependency ([#10388](https://github.com/mastra-ai/mastra/pull/10388))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`6de8ffd`](https://github.com/mastra-ai/mastra/commit/6de8ffda7ab06bce012fdeac3eacc6d2d138c097), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`87cf8d3`](https://github.com/mastra-ai/mastra/commit/87cf8d37564040eb4137a5923edb134c6ea51114), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`922305b`](https://github.com/mastra-ai/mastra/commit/922305b747c9b081b51af81f5f4d5ba09fb22f5d), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`497f918`](https://github.com/mastra-ai/mastra/commit/497f9182135aaf2beb00887d94fcd93afe149d8b), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`dfe0f61`](https://github.com/mastra-ai/mastra/commit/dfe0f61b48a8b0ad43e55b0c88920089d199a7eb), [`ee6c628`](https://github.com/mastra-ai/mastra/commit/ee6c628fabfb18323bee319268d122f3835e393f)]:
  - @mastra/core@1.0.0-beta.5
  - @mastra/ai-sdk@1.0.0-beta.4
  - @mastra/client-js@1.0.0-beta.5
  - @mastra/react@0.1.0-beta.5

## 7.0.0-beta.4

### Patch Changes

- Updated dependencies [[`47c34d8`](https://github.com/mastra-ai/mastra/commit/47c34d8e8c3e8aae5c00efc6085c064f2404b346), [`6a86fe5`](https://github.com/mastra-ai/mastra/commit/6a86fe56b8ff53ca2eb3ed87ffc0748749ebadce), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`595a3b8`](https://github.com/mastra-ai/mastra/commit/595a3b8727c901f44e333909c09843c711224440), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908)]:
  - @mastra/ai-sdk@1.0.0-beta.3
  - @mastra/client-js@1.0.0-beta.4
  - @mastra/core@1.0.0-beta.4
  - @mastra/react@0.1.0-beta.4

## 7.0.0-beta.3

### Patch Changes

- dependencies updates: ([#10057](https://github.com/mastra-ai/mastra/pull/10057))
  - Updated dependency [`@uiw/codemirror-theme-github@^4.25.3` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-github/v/4.25.3) (from `^4.25.2`, in `dependencies`)

- dependencies updates: ([#10085](https://github.com/mastra-ai/mastra/pull/10085))
  - Updated dependency [`@xyflow/react@^12.9.3` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.9.3) (from `^12.8.6`, in `dependencies`)

- dependencies updates: ([#9850](https://github.com/mastra-ai/mastra/pull/9850))
  - Updated dependency [`@dagrejs/dagre@^1.1.8` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.8) (from `^1.1.5`, in `dependencies`)

- Refactor agent information for easier cloud recomposable UIs ([#9995](https://github.com/mastra-ai/mastra/pull/9995))

- Add export for agent memory for use in cloud ([#10025](https://github.com/mastra-ai/mastra/pull/10025))

- Fix scorer filtering for SpanScoring, add error and info message for user ([#10160](https://github.com/mastra-ai/mastra/pull/10160))

- Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise. ([#10036](https://github.com/mastra-ai/mastra/pull/10036))
  MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
  Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
  Templates have been cleaned up
  small docs updates based off of how the template migrations went

- Fix double scroll on agent chat container ([#10253](https://github.com/mastra-ai/mastra/pull/10253))

- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`b98ba1a`](https://github.com/mastra-ai/mastra/commit/b98ba1af73e5d6106965c3de30fbe9e6edc907ce), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`271519f`](https://github.com/mastra-ai/mastra/commit/271519ffffb7efcd5bd2a34ec5c290620c4e7114), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3
  - @mastra/ai-sdk@1.0.0-beta.2
  - @mastra/client-js@1.0.0-beta.3
  - @mastra/react@0.1.0-beta.3

## 7.0.0-beta.2

### Patch Changes

- Make suspendPayload optional when calling `suspend()` ([#9926](https://github.com/mastra-ai/mastra/pull/9926))
  Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
  Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
  Show actual suspendPayload on Studio in suspend/resume flow
- Updated dependencies [[`627067b`](https://github.com/mastra-ai/mastra/commit/627067b22eeb26601f65fee3646ba17fc0c91501), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46)]:
  - @mastra/ai-sdk@1.0.0-beta.1
  - @mastra/core@1.0.0-beta.2
  - @mastra/client-js@1.0.0-beta.2
  - @mastra/react@0.1.0-beta.2

## 7.0.0-beta.1

### Patch Changes

- Make MainSidebar toggle button sticky to bottom, always visible ([#9682](https://github.com/mastra-ai/mastra/pull/9682))

- Removing uneeded files ([#9877](https://github.com/mastra-ai/mastra/pull/9877))

- Explicitly set color of line number in CodeMirror ([#9878](https://github.com/mastra-ai/mastra/pull/9878))

- Add visual styles and labels for more workflow node types ([#9777](https://github.com/mastra-ai/mastra/pull/9777))

- Updated dependencies [[`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`dbd9db0`](https://github.com/mastra-ai/mastra/commit/dbd9db0d5c2797a210b9098e7e3e613718e5442f), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d)]:
  - @mastra/core@1.0.0-beta.1
  - @mastra/client-js@1.0.0-beta.1
  - @mastra/react@0.1.0-beta.1

## 7.0.0-beta.0

### Major Changes

- # Major Changes ([#9695](https://github.com/mastra-ai/mastra/pull/9695))

  ## Storage Layer

  ### BREAKING: Removed `storage.getMessages()`

  The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

  **Migration:**

  ```typescript
  // Before
  const messages = await storage.getMessages({ threadId: 'thread-1' });

  // After
  const result = await storage.listMessages({
    threadId: 'thread-1',
    page: 0,
    perPage: 50,
  });
  const messages = result.messages; // Access messages array
  console.log(result.total); // Total count
  console.log(result.hasMore); // Whether more pages exist
  ```

  ### Message ordering default

  `listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

  **To use DESC ordering (newest first):**

  ```typescript
  const result = await storage.listMessages({
    threadId: 'thread-1',
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  ```

  ## Client SDK

  ### BREAKING: Renamed `client.getThreadMessages()` → `client.listThreadMessages()`

  **Migration:**

  ```typescript
  // Before
  const response = await client.getThreadMessages(threadId, { agentId });

  // After
  const response = await client.listThreadMessages(threadId, { agentId });
  ```

  The response format remains the same.

  ## Type Changes

  ### BREAKING: Removed `StorageGetMessagesArg` type

  Use `StorageListMessagesInput` instead:

  ```typescript
  // Before
  import type { StorageGetMessagesArg } from '@mastra/core';

  // After
  import type { StorageListMessagesInput } from '@mastra/core';
  ```

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  ### What's Changed
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

- **BREAKING CHANGE**: Pagination APIs now use `page`/`perPage` instead of `offset`/`limit` ([#9592](https://github.com/mastra-ai/mastra/pull/9592))

  All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

  **Affected APIs:**
  - `Memory.listThreadsByResourceId()`
  - `Memory.listMessages()`
  - `Storage.listWorkflowRuns()`

  **Migration:**

  ```typescript
  // Before
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    page: 2, // page = Math.floor(offset / limit)
    perPage: 10,
  });

  // Before
  await memory.listMessages({
    threadId: 'thread-456',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listMessages({
    threadId: 'thread-456',
    page: 2,
    perPage: 10,
  });

  // Before
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    offset: 20,
    limit: 10,
  });

  // After
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    page: 2,
    perPage: 10,
  });
  ```

  **Additional improvements:**
  - Added validation for negative `page` values in all storage implementations
  - Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
  - Added reusable query parser utilities for consistent validation in handlers

- ```([#9709](https://github.com/mastra-ai/mastra/pull/9709))
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: new Observability({
      default: { enabled: true }
    })  // Instance
  });
  ```

  Instead of:

  ```
  import { Mastra } from '@mastra/core';
  import '@mastra/observability/init';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: {
      default: { enabled: true }
    }
  });
  ```

  Also renamed a bunch of:
  - `Tracing` things to `Observability` things.
  - `AI-` things to just things.

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Update peer dependencies to match core package version bump (0.22.1) ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Toast error from workflow stream and resume stream ([#9431](https://github.com/mastra-ai/mastra/pull/9431))
  Update peer dependencies to match core package version bump (0.22.3)

- Update peer dependencies to match core package version bump (0.22.0) ([#9045](https://github.com/mastra-ai/mastra/pull/9045))

### Patch Changes

- dependencies updates: ([#9800](https://github.com/mastra-ai/mastra/pull/9800))
  - Updated dependency [`@lezer/highlight@^1.2.3` ↗︎](https://www.npmjs.com/package/@lezer/highlight/v/1.2.3) (from `^1.2.1`, in `dependencies`)

- fetch from the client-js sdk instead of local fetch ([#9376](https://github.com/mastra-ai/mastra/pull/9376))

- Update MainSidebar component to fit required changes in Cloud CTA link ([#9318](https://github.com/mastra-ai/mastra/pull/9318))

- Add enhance instruction capability + instruction tweak for experiment purpose ([#9302](https://github.com/mastra-ai/mastra/pull/9302))

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Use client-js search memory instead of custom fetch one ([#9326](https://github.com/mastra-ai/mastra/pull/9326))

- Render zod unions and discriminated unions correctly in dynamic form. ([#9317](https://github.com/mastra-ai/mastra/pull/9317))

- Add breacrumb action for popovers ([#9378](https://github.com/mastra-ai/mastra/pull/9378))

- Prefill `providerOptions` on Mastra Studio. When creating your agent, you can add `providerOptions` to the Agent `instructions`, we now prefill the `providerOptions` field on Mastra Studio model settings advanced settings section with the `instructions.providerOptions` added. ([#9156](https://github.com/mastra-ai/mastra/pull/9156))

  Example agent code

  ```@typescript
  export const chefModelV2Agent = new Agent({
    name: 'Chef Agent V2 Model',
    description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
    instructions: {
      content: `
        You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
        ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
        You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
        `,
      role: 'system',
      providerOptions: {
        openai: {
          reasoning_effort: 'high',
        },
      },
    },
    model: openai('gpt-4o-mini'),
    tools: {
      cookingTool,
    },
    memory
  });
  ```

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Fix multi modal in playground-ui ([#9373](https://github.com/mastra-ai/mastra/pull/9373))

- Remove "show trace" that pointed to legacy traces ([#9470](https://github.com/mastra-ai/mastra/pull/9470))

- Fix resume form for nested workflow not displaying when viewing a previously suspended run on studio ([#9805](https://github.com/mastra-ai/mastra/pull/9805))

- Avoid fetch retries when fetching model providers ([#9452](https://github.com/mastra-ai/mastra/pull/9452))

- Remove unused /model-providers API ([#9533](https://github.com/mastra-ai/mastra/pull/9533))

- Fix undefined runtimeContext using memory from playground ([#9328](https://github.com/mastra-ai/mastra/pull/9328))

- Fix playground white screen when Zod discriminatedUnion is intersected using `and()`. ([#9692](https://github.com/mastra-ai/mastra/pull/9692))
  This now works, but zod validation will fail, please use `extend` instead

  Instead of

  ```
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }),
  ]).and(
    z.object({ order: z.number() })
  )
  ```

  do

  ```
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('byCity'), city: z.string() }).extend({ order: z.number() }),
    z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }).extend({ order: z.number() }),
  ]);
  ```

- Extract more components to playground-ui for sharing with cloud ([#9241](https://github.com/mastra-ai/mastra/pull/9241))

- Fix undefined window issue when Sidebar used in Next app ([#9448](https://github.com/mastra-ai/mastra/pull/9448))

- Move WorkflowInformation to playground-ui ([#9297](https://github.com/mastra-ai/mastra/pull/9297))

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Add combobox in playground for entities and update routes and error handling ([#9743](https://github.com/mastra-ai/mastra/pull/9743))

- **Breaking Changes:** ([#9045](https://github.com/mastra-ai/mastra/pull/9045))
  - Moved `generateTitle` from `threads.generateTitle` to top-level memory option
  - Changed default value from `true` to `false`
  - Using `threads.generateTitle` now throws an error

  **Migration:**
  Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

  **Playground:**
  The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.

- Move some components to playground-ui for usage in cloud ([#9177](https://github.com/mastra-ai/mastra/pull/9177))

- Fix the link from traces to workflow ([#9764](https://github.com/mastra-ai/mastra/pull/9764))

- Remove unecessary react components + dependencies ([#9295](https://github.com/mastra-ai/mastra/pull/9295))

- Fix studio crashing when message contains non JSON text output of tool call ([#9189](https://github.com/mastra-ai/mastra/pull/9189))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`7491634`](https://github.com/mastra-ai/mastra/commit/7491634fd198c37d9934675756b274ae2e5e415e), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`1ee3411`](https://github.com/mastra-ai/mastra/commit/1ee34113192b11aa8bcdd8d9d5830ae13254b345), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`f93d992`](https://github.com/mastra-ai/mastra/commit/f93d992a37d5431ab4a71246835d403ef7c4ce85), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`ea0b8de`](https://github.com/mastra-ai/mastra/commit/ea0b8dec0d4bc86a72a7e75b2f56c6017c58786d), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`d4efaf3`](https://github.com/mastra-ai/mastra/commit/d4efaf34e6ec269714d50984d2ba7858f2d2079f), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`0b6112e`](https://github.com/mastra-ai/mastra/commit/0b6112eea01134d2dce13aabda8bb15c37993315), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`519d9e6`](https://github.com/mastra-ai/mastra/commit/519d9e6d31910457c54bdae8b7b7cb3a69f41831), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`e8dcd71`](https://github.com/mastra-ai/mastra/commit/e8dcd71fa5e473c8ba1d6dad99eef182d20a0491), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`63f2f18`](https://github.com/mastra-ai/mastra/commit/63f2f1863dffe3ad23221d0660ed4e4f2b81789d), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`e4ab0a4`](https://github.com/mastra-ai/mastra/commit/e4ab0a4ff7aae1b837cfbd8fb726fc1376165b56), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`7fa87f0`](https://github.com/mastra-ai/mastra/commit/7fa87f09b9edfd45a274e5e0d5e109d1a5d9ae8b), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0
  - @mastra/client-js@1.0.0-beta.0
  - @mastra/ai-sdk@1.0.0-beta.0
  - @mastra/react@0.1.0-beta.0

## 6.6.2

### Patch Changes

- Move all the fetching hooks that should be shared with cloud into playground-ui ([#9133](https://github.com/mastra-ai/mastra/pull/9133))

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2
  - @mastra/client-js@0.16.4
  - @mastra/react@0.0.10

## 6.6.2-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0
  - @mastra/client-js@0.16.4-alpha.0
  - @mastra/react@0.0.10-alpha.0

## 6.6.1

### Patch Changes

- Fix subagent link not working in agents overview pane ([#9099](https://github.com/mastra-ai/mastra/pull/9099))

- Fix wrong MCP link in playground ([#9103](https://github.com/mastra-ai/mastra/pull/9103))

- Updated dependencies []:
  - @mastra/core@0.22.1
  - @mastra/client-js@0.16.3
  - @mastra/react@0.0.9

## 6.6.1-alpha.0

### Patch Changes

- Fix subagent link not working in agents overview pane ([#9099](https://github.com/mastra-ai/mastra/pull/9099))

- Fix wrong MCP link in playground ([#9103](https://github.com/mastra-ai/mastra/pull/9103))

- Updated dependencies []:
  - @mastra/core@0.22.1-alpha.0
  - @mastra/client-js@0.16.3-alpha.0
  - @mastra/react@0.0.9-alpha.0

## 6.6.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Handle nested optional objects in dynamic form ([#9059](https://github.com/mastra-ai/mastra/pull/9059))

- Threads are not refreshing correctly after generate / stream / network ([#9015](https://github.com/mastra-ai/mastra/pull/9015))

- Move "Playground" to "Studio" in UI only ([#9052](https://github.com/mastra-ai/mastra/pull/9052))

- fix template background image overflow ([#9011](https://github.com/mastra-ai/mastra/pull/9011))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`1f058c6`](https://github.com/mastra-ai/mastra/commit/1f058c63ccb88d718b9876490d17e112cc026467), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`5ea29c6`](https://github.com/mastra-ai/mastra/commit/5ea29c6a72dc3a6c837076fd37ee54ebae77a02a), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0
  - @mastra/react@0.0.8
  - @mastra/client-js@0.16.2

## 6.6.0-alpha.1

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Handle nested optional objects in dynamic form ([#9059](https://github.com/mastra-ai/mastra/pull/9059))

- Move "Playground" to "Studio" in UI only ([#9052](https://github.com/mastra-ai/mastra/pull/9052))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`1f058c6`](https://github.com/mastra-ai/mastra/commit/1f058c63ccb88d718b9876490d17e112cc026467), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`5ea29c6`](https://github.com/mastra-ai/mastra/commit/5ea29c6a72dc3a6c837076fd37ee54ebae77a02a), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1
  - @mastra/react@0.0.8-alpha.1
  - @mastra/client-js@0.16.2-alpha.1

## 6.5.2-alpha.0

### Patch Changes

- Threads are not refreshing correctly after generate / stream / network ([#9015](https://github.com/mastra-ai/mastra/pull/9015))

- fix template background image overflow ([#9011](https://github.com/mastra-ai/mastra/pull/9011))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0
  - @mastra/client-js@0.16.2-alpha.0
  - @mastra/react@0.0.8-alpha.0

## 6.5.1

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`9ba695e`](https://github.com/mastra-ai/mastra/commit/9ba695e9ff977b8f13cc71df3b452775757361e5), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1
  - @mastra/react@0.0.7
  - @mastra/client-js@0.16.1

## 6.5.1-alpha.0

### Patch Changes

- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`9ba695e`](https://github.com/mastra-ai/mastra/commit/9ba695e9ff977b8f13cc71df3b452775757361e5), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1-alpha.0
  - @mastra/react@0.0.7-alpha.0
  - @mastra/client-js@0.16.1-alpha.0

## 6.5.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

### Patch Changes

- dependencies updates: ([#8685](https://github.com/mastra-ai/mastra/pull/8685))
  - Updated dependency [`zod@^4.1.12` ↗︎](https://www.npmjs.com/package/zod/v/4.1.12) (from `^4.1.9`, in `dependencies`)

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Fix auto tab for model picker in playground-ui, the UI no longer auto tabs to the next selector when selecting a model/provider. ([#8680](https://github.com/mastra-ai/mastra/pull/8680))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Adds reset button to model picker to reset to original model set on the agent. ([#8633](https://github.com/mastra-ai/mastra/pull/8633))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- Make sure to convert the agent instructions when showing them ([#8702](https://github.com/mastra-ai/mastra/pull/8702))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`f920afd`](https://github.com/mastra-ai/mastra/commit/f920afdf8725d14d73f895f51a24bb7c79bb4fba), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`421f019`](https://github.com/mastra-ai/mastra/commit/421f01949651d2766046ca1961e32a2dc2fd712b), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`288c2ec`](https://github.com/mastra-ai/mastra/commit/288c2ec873ff9f296cebfdb4654d1b9ba498ad9b), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`2a90197`](https://github.com/mastra-ai/mastra/commit/2a90197276e8439a1ee8371c10cde4d6a23bddef), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`c3ef11f`](https://github.com/mastra-ai/mastra/commit/c3ef11f76e1931cf8f041e9eccf3b382260da022), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`5f7c6a9`](https://github.com/mastra-ai/mastra/commit/5f7c6a986cd9469279820961f8da0a0321fbbd71), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/react@0.0.6
  - @mastra/core@0.21.0
  - @mastra/client-js@0.16.0

## 6.5.0-alpha.4

### Patch Changes

- Updated dependencies [[`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c)]:
  - @mastra/core@0.21.0-alpha.4
  - @mastra/client-js@0.16.0-alpha.4
  - @mastra/react@0.0.6-alpha.4

## 6.5.0-alpha.3

### Patch Changes

- Updated dependencies [[`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8)]:
  - @mastra/core@0.21.0-alpha.3
  - @mastra/client-js@0.16.0-alpha.3
  - @mastra/react@0.0.6-alpha.3

## 6.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c)]:
  - @mastra/core@0.21.0-alpha.2
  - @mastra/client-js@0.16.0-alpha.2
  - @mastra/react@0.0.6-alpha.2

## 6.5.0-alpha.1

### Patch Changes

- Improve the surface API of the react sdk ([#8715](https://github.com/mastra-ai/mastra/pull/8715))

- Fix auto tab for model picker in playground-ui, the UI no longer auto tabs to the next selector when selecting a model/provider. ([#8680](https://github.com/mastra-ai/mastra/pull/8680))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Updated dependencies [[`421f019`](https://github.com/mastra-ai/mastra/commit/421f01949651d2766046ca1961e32a2dc2fd712b), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`288c2ec`](https://github.com/mastra-ai/mastra/commit/288c2ec873ff9f296cebfdb4654d1b9ba498ad9b), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61)]:
  - @mastra/react@0.0.6-alpha.1
  - @mastra/core@0.21.0-alpha.1
  - @mastra/client-js@0.16.0-alpha.1

## 6.5.0-alpha.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

### Patch Changes

- dependencies updates: ([#8685](https://github.com/mastra-ai/mastra/pull/8685))
  - Updated dependency [`zod@^4.1.12` ↗︎](https://www.npmjs.com/package/zod/v/4.1.12) (from `^4.1.9`, in `dependencies`)

- Prepares some basic set of homemade components ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Adds reset button to model picker to reset to original model set on the agent. ([#8633](https://github.com/mastra-ai/mastra/pull/8633))

- Fix back the tripwire verification inside the new react system ([#8674](https://github.com/mastra-ai/mastra/pull/8674))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- handle error case in react sdk ([#8676](https://github.com/mastra-ai/mastra/pull/8676))

- Make sure to convert the agent instructions when showing them ([#8702](https://github.com/mastra-ai/mastra/pull/8702))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- fix maxSteps model settings not being passed to generate and stream endpoints ([#8627](https://github.com/mastra-ai/mastra/pull/8627))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`f920afd`](https://github.com/mastra-ai/mastra/commit/f920afdf8725d14d73f895f51a24bb7c79bb4fba), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`2a90197`](https://github.com/mastra-ai/mastra/commit/2a90197276e8439a1ee8371c10cde4d6a23bddef), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`c3ef11f`](https://github.com/mastra-ai/mastra/commit/c3ef11f76e1931cf8f041e9eccf3b382260da022), [`78cfb6b`](https://github.com/mastra-ai/mastra/commit/78cfb6b66fe88bc848105fccb6459fd75413ec87), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`5f7c6a9`](https://github.com/mastra-ai/mastra/commit/5f7c6a986cd9469279820961f8da0a0321fbbd71), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/react@0.0.6-alpha.0
  - @mastra/core@0.21.0-alpha.0
  - @mastra/client-js@0.16.0-alpha.0

## 6.4.1

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2
  - @mastra/client-js@0.15.2
  - @mastra/react@0.0.5

## 6.4.1-alpha.1

### Patch Changes

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2-alpha.1
  - @mastra/client-js@0.15.2-alpha.1
  - @mastra/react@0.0.5-alpha.1

## 6.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0
  - @mastra/client-js@0.15.2-alpha.0
  - @mastra/react@0.0.5-alpha.0

## 6.4.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- extract mcp servers into playground + use a table instead of custom stuff ([#8521](https://github.com/mastra-ai/mastra/pull/8521))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1
  - @mastra/client-js@0.15.1
  - @mastra/react@0.0.4

## 6.4.0-alpha.4

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI
- Updated dependencies [[`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d)]:
  - @mastra/core@0.20.1-alpha.4
  - @mastra/client-js@0.15.1-alpha.4
  - @mastra/react@0.0.4-alpha.4

## 6.3.1-alpha.3

### Patch Changes

- Updated dependencies [[`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86)]:
  - @mastra/core@0.20.1-alpha.3
  - @mastra/client-js@0.15.1-alpha.3
  - @mastra/react@0.0.4-alpha.3

## 6.3.1-alpha.2

### Patch Changes

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- Updated dependencies [[`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c)]:
  - @mastra/core@0.20.1-alpha.2
  - @mastra/client-js@0.15.1-alpha.2
  - @mastra/react@0.0.4-alpha.2

## 6.3.1-alpha.1

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- extract mcp servers into playground + use a table instead of custom stuff ([#8521](https://github.com/mastra-ai/mastra/pull/8521))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1
  - @mastra/client-js@0.15.1-alpha.1
  - @mastra/react@0.0.4-alpha.1

## 6.3.1-alpha.0

### Patch Changes

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0
  - @mastra/client-js@0.15.1-alpha.0
  - @mastra/react@0.0.4-alpha.0

## 6.3.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- dependencies updates: ([#8298](https://github.com/mastra-ai/mastra/pull/8298))
  - Updated dependency [`@xyflow/react@^12.8.6` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.6) (from `^12.8.5`, in `dependencies`)

- dependencies updates: ([#8333](https://github.com/mastra-ai/mastra/pull/8333))
  - Updated dependency [`motion@^12.23.22` ↗︎](https://www.npmjs.com/package/motion/v/12.23.22) (from `^12.23.13`, in `dependencies`)

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`b537cce`](https://github.com/mastra-ai/mastra/commit/b537cce9f83d801f73b3328a17eb61b7701a11ea), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`96d4600`](https://github.com/mastra-ai/mastra/commit/96d4600723d5c26cd4cb67ea3c02f76ad78a6887), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0
  - @mastra/react@0.0.3
  - @mastra/client-js@0.15.0

## 6.3.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- dependencies updates: ([#8298](https://github.com/mastra-ai/mastra/pull/8298))
  - Updated dependency [`@xyflow/react@^12.8.6` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.6) (from `^12.8.5`, in `dependencies`)

- dependencies updates: ([#8333](https://github.com/mastra-ai/mastra/pull/8333))
  - Updated dependency [`motion@^12.23.22` ↗︎](https://www.npmjs.com/package/motion/v/12.23.22) (from `^12.23.13`, in `dependencies`)

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- generateVNext into react SDK + to asistant ui message ([#8345](https://github.com/mastra-ai/mastra/pull/8345))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- distinguish between legacy and regular messages in agent chat for useChat usage ([#8409](https://github.com/mastra-ai/mastra/pull/8409))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`b537cce`](https://github.com/mastra-ai/mastra/commit/b537cce9f83d801f73b3328a17eb61b7701a11ea), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`96d4600`](https://github.com/mastra-ai/mastra/commit/96d4600723d5c26cd4cb67ea3c02f76ad78a6887), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0
  - @mastra/react@0.0.3-alpha.0
  - @mastra/client-js@0.15.0-alpha.0

## 6.2.4

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1
  - @mastra/client-js@0.14.1
  - @mastra/react@0.0.2

## 6.2.4-alpha.1

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead)]:
  - @mastra/core@0.19.1-alpha.1
  - @mastra/client-js@0.14.1-alpha.1
  - @mastra/react@0.0.2-alpha.1

## 6.2.4-alpha.0

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1-alpha.0
  - @mastra/client-js@0.14.1-alpha.0
  - @mastra/react@0.0.2-alpha.0

## 6.2.3

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fix an issue about instructions not working in a different format than string ([#8284](https://github.com/mastra-ai/mastra/pull/8284))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`8e087b1`](https://github.com/mastra-ai/mastra/commit/8e087b126c0e1a38dd45bde24bdb97d1ecaacca4), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/client-js@0.14.0
  - @mastra/core@0.19.0
  - @mastra/react@0.0.1

## 6.2.3-alpha.1

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fix an issue about instructions not working in a different format than string ([#8284](https://github.com/mastra-ai/mastra/pull/8284))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- modify the useMastraChat hook to useChat ([#8265](https://github.com/mastra-ai/mastra/pull/8265))

- Updated dependencies [[`5cb4596`](https://github.com/mastra-ai/mastra/commit/5cb4596c644104ea817bb0c5a07b8b1f8de595a8), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`86be6be`](https://github.com/mastra-ai/mastra/commit/86be6bee7e64b7d828a6b4eec283265c820dfa43), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`8e087b1`](https://github.com/mastra-ai/mastra/commit/8e087b126c0e1a38dd45bde24bdb97d1ecaacca4), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/client-js@0.14.0-alpha.1
  - @mastra/core@0.19.0-alpha.1
  - @mastra/react@0.0.1-alpha.1

## 6.2.3-alpha.0

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/client-js@0.14.0-alpha.0
  - @mastra/core@0.18.1-alpha.0
  - @mastra/react-hooks@0.0.1-alpha.1

## 6.2.2

### Patch Changes

- dependencies updates: ([#7980](https://github.com/mastra-ai/mastra/pull/7980))
  - Updated dependency [`zod@^4.1.8` ↗︎](https://www.npmjs.com/package/zod/v/4.1.8) (from `^4.1.5`, in `dependencies`)

- dependencies updates: ([#8019](https://github.com/mastra-ai/mastra/pull/8019))
  - Updated dependency [`motion@^12.23.13` ↗︎](https://www.npmjs.com/package/motion/v/12.23.13) (from `^12.23.12`, in `dependencies`)

- dependencies updates: ([#8034](https://github.com/mastra-ai/mastra/pull/8034))
  - Updated dependency [`zod@^4.1.9` ↗︎](https://www.npmjs.com/package/zod/v/4.1.9) (from `^4.1.8`, in `dependencies`)

- dependencies updates: ([#8050](https://github.com/mastra-ai/mastra/pull/8050))
  - Updated dependency [`@xyflow/react@^12.8.5` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.5) (from `^12.8.4`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Add UI for scoring traces ([#8089](https://github.com/mastra-ai/mastra/pull/8089))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0
  - @mastra/client-js@0.13.2

## 6.2.2-alpha.4

### Patch Changes

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

## 6.2.2-alpha.3

### Patch Changes

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Add UI for scoring traces ([#8089](https://github.com/mastra-ai/mastra/pull/8089))

- Updated dependencies [[`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0-alpha.3
  - @mastra/client-js@0.13.2-alpha.3

## 6.2.2-alpha.2

### Patch Changes

- dependencies updates: ([#8034](https://github.com/mastra-ai/mastra/pull/8034))
  - Updated dependency [`zod@^4.1.9` ↗︎](https://www.npmjs.com/package/zod/v/4.1.9) (from `^4.1.8`, in `dependencies`)

- dependencies updates: ([#8050](https://github.com/mastra-ai/mastra/pull/8050))
  - Updated dependency [`@xyflow/react@^12.8.5` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.5) (from `^12.8.4`, in `dependencies`)

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2
  - @mastra/client-js@0.13.2-alpha.2

## 6.2.2-alpha.1

### Patch Changes

- dependencies updates: ([#8019](https://github.com/mastra-ai/mastra/pull/8019))
  - Updated dependency [`motion@^12.23.13` ↗︎](https://www.npmjs.com/package/motion/v/12.23.13) (from `^12.23.12`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1
  - @mastra/client-js@0.13.2-alpha.1

## 6.2.2-alpha.0

### Patch Changes

- dependencies updates: ([#7980](https://github.com/mastra-ai/mastra/pull/7980))
  - Updated dependency [`zod@^4.1.8` ↗︎](https://www.npmjs.com/package/zod/v/4.1.8) (from `^4.1.5`, in `dependencies`)

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/client-js@0.13.2-alpha.0
  - @mastra/core@0.17.2-alpha.0

## 6.2.1

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1
  - @mastra/client-js@0.13.1

## 6.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0
  - @mastra/client-js@0.13.1-alpha.0

## 6.2.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7802](https://github.com/mastra-ai/mastra/pull/7802))
  - Updated dependency [`react-syntax-highlighter@^15.6.6` ↗︎](https://www.npmjs.com/package/react-syntax-highlighter/v/15.6.6) (from `^15.6.1`, in `dependencies`)

- dependencies updates: ([#7868](https://github.com/mastra-ai/mastra/pull/7868))
  - Updated dependency [`swr@^2.3.6` ↗︎](https://www.npmjs.com/package/swr/v/2.3.6) (from `^2.3.4`, in `dependencies`)

- dependencies updates: ([#7908](https://github.com/mastra-ai/mastra/pull/7908))
  - Updated dependency [`use-debounce@^10.0.6` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.6) (from `^10.0.5`, in `dependencies`)

- dependencies updates: ([#7912](https://github.com/mastra-ai/mastra/pull/7912))
  - Updated dependency [`zustand@^5.0.8` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.8) (from `^5.0.7`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Update data printed in AI span dialogs ([#7847](https://github.com/mastra-ai/mastra/pull/7847))

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- Add default width to AI span timeline presentation ([#7853](https://github.com/mastra-ai/mastra/pull/7853))

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- Fixed createRun change in agent builder that was missed ([#7966](https://github.com/mastra-ai/mastra/pull/7966))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Set null as empty value for score prompts ([#7875](https://github.com/mastra-ai/mastra/pull/7875))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`cdc63c0`](https://github.com/mastra-ai/mastra/commit/cdc63c0d2725ee0191aa7f5287ccf83629019748), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`e6e37a0`](https://github.com/mastra-ai/mastra/commit/e6e37a05ec2b6de4f34ee77bb2dd08edfae4ae4a), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0
  - @mastra/client-js@0.13.0

## 6.2.0-alpha.5

### Patch Changes

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8
  - @mastra/client-js@0.13.0-alpha.8

## 6.2.0-alpha.4

### Patch Changes

- Fixed createRun change in agent builder that was missed ([#7966](https://github.com/mastra-ai/mastra/pull/7966))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7
  - @mastra/client-js@0.13.0-alpha.7

## 6.2.0-alpha.3

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7908](https://github.com/mastra-ai/mastra/pull/7908))
  - Updated dependency [`use-debounce@^10.0.6` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.6) (from `^10.0.5`, in `dependencies`)

- dependencies updates: ([#7912](https://github.com/mastra-ai/mastra/pull/7912))
  - Updated dependency [`zustand@^5.0.8` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.8) (from `^5.0.7`, in `dependencies`)

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6
  - @mastra/client-js@0.13.0-alpha.6

## 6.1.4-alpha.2

### Patch Changes

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`c4dbd12`](https://github.com/mastra-ai/mastra/commit/c4dbd12a05e75db124c5d8abff3d893ea1b88c30), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4
  - @mastra/client-js@0.13.0-alpha.4

## 6.1.4-alpha.1

### Patch Changes

- dependencies updates: ([#7802](https://github.com/mastra-ai/mastra/pull/7802))
  - Updated dependency [`react-syntax-highlighter@^15.6.6` ↗︎](https://www.npmjs.com/package/react-syntax-highlighter/v/15.6.6) (from `^15.6.1`, in `dependencies`)

- dependencies updates: ([#7868](https://github.com/mastra-ai/mastra/pull/7868))
  - Updated dependency [`swr@^2.3.6` ↗︎](https://www.npmjs.com/package/swr/v/2.3.6) (from `^2.3.4`, in `dependencies`)

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Update data printed in AI span dialogs ([#7847](https://github.com/mastra-ai/mastra/pull/7847))

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- Add default width to AI span timeline presentation ([#7853](https://github.com/mastra-ai/mastra/pull/7853))

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- Set null as empty value for score prompts ([#7875](https://github.com/mastra-ai/mastra/pull/7875))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3
  - @mastra/client-js@0.12.4-alpha.3

## 6.1.4-alpha.0

### Patch Changes

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`cdc63c0`](https://github.com/mastra-ai/mastra/commit/cdc63c0d2725ee0191aa7f5287ccf83629019748), [`e6e37a0`](https://github.com/mastra-ai/mastra/commit/e6e37a05ec2b6de4f34ee77bb2dd08edfae4ae4a), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0
  - @mastra/client-js@0.12.4-alpha.0

## 6.1.3

### Patch Changes

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/client-js@0.12.3

## 6.1.3-alpha.1

### Patch Changes

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812)]:
  - @mastra/client-js@0.12.3-alpha.1
  - @mastra/core@0.16.3-alpha.1

## 6.1.3-alpha.0

### Patch Changes

- AN packages ([#7711](https://github.com/mastra-ai/mastra/pull/7711))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/client-js@0.12.3-alpha.0

## 6.1.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2
  - @mastra/client-js@0.12.2

## 6.1.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0
  - @mastra/client-js@0.12.2-alpha.0

## 6.1.1

### Patch Changes

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`9ad094f`](https://github.com/mastra-ai/mastra/commit/9ad094fe813b115734a0c1f4859fe4191e05b186), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1
  - @mastra/client-js@0.12.1

## 6.1.1-alpha.2

### Patch Changes

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3
  - @mastra/client-js@0.12.1-alpha.3

## 6.1.1-alpha.1

### Patch Changes

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`9ad094f`](https://github.com/mastra-ai/mastra/commit/9ad094fe813b115734a0c1f4859fe4191e05b186)]:
  - @mastra/core@0.16.1-alpha.1
  - @mastra/client-js@0.12.1-alpha.1

## 6.1.1-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0
  - @mastra/client-js@0.12.1-alpha.0

## 6.1.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)
- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [8fbf79e]
- Updated dependencies [cf4e353]
- Updated dependencies [6155cfc]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0
  - @mastra/client-js@0.12.0

## 6.1.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/client-js@0.12.0-alpha.1

## 6.1.0-alpha.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [cf4e353]
- Updated dependencies [6155cfc]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/client-js@0.12.0-alpha.0
  - @mastra/core@0.16.0-alpha.0

## 6.0.0

### Major Changes

- 0c2a95f: Fix submit button visibility in DynamicForm of ToolExecutor by ensuring extra bottom spacing.

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod@^4.1.5` ↗︎](https://www.npmjs.com/package/zod/v/4.1.5) (from `^4.0.15`, in `dependencies`)
- dbdc91f: dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.44` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.44) (from `^0.7.91`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.10.9` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.10.9) (from `^0.7.21`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.10.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.10.10) (from `^0.7.10`, in `dependencies`)
  - Added dependency [`@assistant-ui/react-ui@^0.1.8` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-ui/v/0.1.8) (to `dependencies`)
- 0fe56ce: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.4) (from `^12.8.2`, in `dependencies`)
- 572acd0: dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.45` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.45) (from `^0.10.44`, in `dependencies`)
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 8e4fe90: Unify focus outlines
- f0dfcac: updated core peerdep
- 87de958: fix chat outline
- 3308c9f: fix dev:playground command
- d99baf6: change outline
- Updated dependencies [ab48c97]
- Updated dependencies [ab48c97]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [26b0d7c]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [fef7375]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [48f0742]
- Updated dependencies [0302f50]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
  - @mastra/client-js@0.11.3
  - @mastra/core@0.15.3

## 6.0.0-alpha.5

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7
  - @mastra/client-js@0.11.3-alpha.7

## 6.0.0-alpha.4

### Patch Changes

- [#7351](https://github.com/mastra-ai/mastra/pull/7351) [`572acd0`](https://github.com/mastra-ai/mastra/commit/572acd0919479455ee654753877f2c1564d0b29e) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.45` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.45) (from `^0.10.44`, in `dependencies`)
- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/core@0.15.3-alpha.6
  - @mastra/client-js@0.11.3-alpha.6

## 6.0.0-alpha.3

### Patch Changes

- [#6969](https://github.com/mastra-ai/mastra/pull/6969) [`0fe56ce`](https://github.com/mastra-ai/mastra/commit/0fe56ce24e1317d545ca24d7f2ec341af9f2085f) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.4) (from `^12.8.2`, in `dependencies`)

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5
  - @mastra/client-js@0.11.3-alpha.5

## 6.0.0-alpha.2

### Major Changes

- [#7265](https://github.com/mastra-ai/mastra/pull/7265) [`0c2a95f`](https://github.com/mastra-ai/mastra/commit/0c2a95ffc0f5a8fcaa3012793f62fcf820690317) Thanks [@HichamELBSI](https://github.com/HichamELBSI)! - Fix submit button visibility in DynamicForm of ToolExecutor by ensuring extra bottom spacing.

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod@^4.1.5` ↗︎](https://www.npmjs.com/package/zod/v/4.1.5) (from `^4.0.15`, in `dependencies`)

- [#5817](https://github.com/mastra-ai/mastra/pull/5817) [`dbdc91f`](https://github.com/mastra-ai/mastra/commit/dbdc91fdedba01bf2fa2e62086a89d2b8101cf8c) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@assistant-ui/react@^0.10.44` ↗︎](https://www.npmjs.com/package/@assistant-ui/react/v/0.10.44) (from `^0.7.91`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-markdown@^0.10.9` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-markdown/v/0.10.9) (from `^0.7.21`, in `dependencies`)
  - Updated dependency [`@assistant-ui/react-syntax-highlighter@^0.10.10` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-syntax-highlighter/v/0.10.10) (from `^0.7.10`, in `dependencies`)
  - Added dependency [`@assistant-ui/react-ui@^0.1.8` ↗︎](https://www.npmjs.com/package/@assistant-ui/react-ui/v/0.1.8) (to `dependencies`)
- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`26b0d7c`](https://github.com/mastra-ai/mastra/commit/26b0d7c7cba46469351d453714e119ac7aae9da2), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/client-js@0.11.3-alpha.4
  - @mastra/core@0.15.3-alpha.4

## 5.2.5-alpha.1

### Patch Changes

- [#7210](https://github.com/mastra-ai/mastra/pull/7210) [`87de958`](https://github.com/mastra-ai/mastra/commit/87de95832a7bdfa9ecb14473c84dc874331f1a7d) Thanks [@mfrachet](https://github.com/mfrachet)! - fix chat outline

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3
  - @mastra/client-js@0.11.3-alpha.3

## 5.2.5-alpha.0

### Patch Changes

- [#7076](https://github.com/mastra-ai/mastra/pull/7076) [`8e4fe90`](https://github.com/mastra-ai/mastra/commit/8e4fe90605ee4dfcfd911a7f07e1355fe49205ba) Thanks [@mfrachet](https://github.com/mfrachet)! - Unify focus outlines

- [#7044](https://github.com/mastra-ai/mastra/pull/7044) [`3308c9f`](https://github.com/mastra-ai/mastra/commit/3308c9ff1da7594925d193a825f33da2880fb9c1) Thanks [@mfrachet](https://github.com/mfrachet)! - fix dev:playground command

- [#7101](https://github.com/mastra-ai/mastra/pull/7101) [`d99baf6`](https://github.com/mastra-ai/mastra/commit/d99baf6e69bbf83e9a286fbd18c47543de12cb58) Thanks [@mfrachet](https://github.com/mfrachet)! - change outline

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/client-js@0.11.3-alpha.0

## 5.2.4

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/client-js@0.11.2
  - @mastra/core@0.15.2

## 5.2.3

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1
  - @mastra/client-js@0.11.1

## 5.2.2

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/client-js@0.11.0

## 5.2.2-alpha.1

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`00ef6c1`](https://github.com/mastra-ai/mastra/commit/00ef6c1d3c76708712acd3de7f39c4d6b0f3b427), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1
  - @mastra/client-js@0.11.0-alpha.1

## 5.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/client-js@0.10.24-alpha.0

## 5.2.1

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/client-js@0.10.23

## 5.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/client-js@0.10.23-alpha.0

## 5.2.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- dd702eb: Fix default in playground
- 6313063: Implement model switcher in playground
- 1d59515: Add options to playground based on modelVersion
- 9ce22c5: Fix swagger-ui link
- 36928f0: Use right icon for anthropic in model switcher
- 2454423: Agentic loop and streaming workflow: generateVNext and streamVNext
- 398ed81: PG types
- Updated dependencies [227c7e6]
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1d59515]
- Updated dependencies [cf4f357]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0
  - @mastra/client-js@0.10.22

## 5.2.0-alpha.6

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- @mastra/core@0.14.0-alpha.7
- @mastra/client-js@0.10.22-alpha.7

## 5.1.21-alpha.5

### Patch Changes

- 9ce22c5: Fix swagger-ui link
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6
  - @mastra/client-js@0.10.22-alpha.6

## 5.1.21-alpha.4

### Patch Changes

- dd702eb: Fix default in playground

## 5.1.21-alpha.3

### Patch Changes

- 1d59515: Add options to playground based on modelVersion
- 398ed81: PG types
- b78b95b: Support generateVNext in playground
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [1d59515]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
  - @mastra/core@0.14.0-alpha.4
  - @mastra/client-js@0.10.22-alpha.4

## 5.1.21-alpha.2

### Patch Changes

- 36928f0: Use right icon for anthropic in model switcher
- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3
  - @mastra/client-js@0.10.22-alpha.3

## 5.1.21-alpha.1

### Patch Changes

- 6313063: Implement model switcher in playground
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1
  - @mastra/client-js@0.10.22-alpha.1

## 5.1.21-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0
  - @mastra/client-js@0.10.22-alpha.0

## 5.1.20

### Patch Changes

- 0d32203: dependencies updates:
  - Updated dependency [`zustand@^5.0.7` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.7) (from `^5.0.6`, in `dependencies`)
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- 7aad750: Fix tool ui showing after message when chat is refreshed
- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [96169cc]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/client-js@0.10.21

## 5.1.20-alpha.1

### Patch Changes

- 0d32203: dependencies updates:
  - Updated dependency [`zustand@^5.0.7` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.7) (from `^5.0.6`, in `dependencies`)
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [96169cc]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2
  - @mastra/client-js@0.10.21-alpha.2

## 5.1.20-alpha.0

### Patch Changes

- 7aad750: Fix tool ui showing after message when chat is refreshed
- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/client-js@0.10.21-alpha.0

## 5.1.19

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1
  - @mastra/client-js@0.10.20

## 5.1.19-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0
  - @mastra/client-js@0.10.20-alpha.0

## 5.1.18

### Patch Changes

- 0ebfe8a: dependencies updates:
  - Updated dependency [`motion@^12.23.12` ↗︎](https://www.npmjs.com/package/motion/v/12.23.12) (from `^12.23.9`, in `dependencies`)
- f5853be: Added a preview button that opens a modal, rendering the markdown in the working memory text area
- ea0c5f2: Update to support new scorer api
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [42dfc48]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0
  - @mastra/client-js@0.10.19

## 5.1.18-alpha.3

### Patch Changes

- f5853be: Added a preview button that opens a modal, rendering the markdown in the working memory text area

## 5.1.18-alpha.2

### Patch Changes

- 0ebfe8a: dependencies updates:
  - Updated dependency [`motion@^12.23.12` ↗︎](https://www.npmjs.com/package/motion/v/12.23.12) (from `^12.23.9`, in `dependencies`)
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [42dfc48]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/client-js@0.10.19-alpha.2

## 5.1.18-alpha.1

### Patch Changes

- ea0c5f2: Update to support new scorer api
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1
  - @mastra/client-js@0.10.19-alpha.1

## 5.1.18-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/client-js@0.10.19-alpha.0

## 5.1.17

### Patch Changes

- d8e8349: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.2` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.2) (from `^12.8.1`, in `dependencies`)
- c8924b6: dependencies updates:
  - Updated dependency [`motion@^12.23.9` ↗︎](https://www.npmjs.com/package/motion/v/12.23.9) (from `^12.23.0`, in `dependencies`)
- Updated dependencies [6690a16]
- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/client-js@0.10.18
  - @mastra/core@0.12.1

## 5.1.17-alpha.0

### Patch Changes

- d8e8349: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.2` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.2) (from `^12.8.1`, in `dependencies`)
- c8924b6: dependencies updates:
  - Updated dependency [`motion@^12.23.9` ↗︎](https://www.npmjs.com/package/motion/v/12.23.9) (from `^12.23.0`, in `dependencies`)
- Updated dependencies [6690a16]
- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/client-js@0.10.18-alpha.0
  - @mastra/core@0.12.1-alpha.0

## 5.1.16

### Patch Changes

- f873f3a: dependencies updates:
  - Updated dependency [`zustand@^5.0.6` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.6) (from `^5.0.5`, in `dependencies`)
- f442224: speech to text using voice config
- 6336993: Fix workflow input form overflow
- f42c4c2: update peer deps for packages to latest core range
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [aa2715b]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [6bd354c]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [b641ba3]
- Updated dependencies [9802f42]
- Updated dependencies [1ac8f6b]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/client-js@0.10.17

## 5.1.16-alpha.2

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
  - @mastra/core@0.12.0-alpha.5
  - @mastra/client-js@0.10.17-alpha.5

## 5.1.16-alpha.1

### Patch Changes

- 6336993: Fix workflow input form overflow
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1
  - @mastra/client-js@0.10.17-alpha.1

## 5.1.16-alpha.0

### Patch Changes

- f873f3a: dependencies updates:
  - Updated dependency [`zustand@^5.0.6` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.6) (from `^5.0.5`, in `dependencies`)
- f442224: speech to text using voice config
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [6bd354c]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
- Updated dependencies [b641ba3]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/client-js@0.10.17-alpha.0

## 5.1.15

### Patch Changes

- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1
  - @mastra/client-js@0.10.16

## 5.1.14

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 0bf0bc8: fix link in shared components + add e2e tests
- f6c4d75: fix date picker on change
- 59f0dcd: Add light background color for step statuses
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 8aa97c7: Show docs link in place of semantic recall + working memory in playground if they're not enabled
- cf8d497: factorize tabs component between cloud and core
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- 09464dd: Share AgentMetadata component with cloud
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80692d5: refactor: sharing only the UI and not data fetching for traces
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [4832752]
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [80c2b06]
- Updated dependencies [7ba91fa]
- Updated dependencies [6f6e651]
  - @mastra/client-js@0.10.15
  - @mastra/core@0.11.0

## 5.1.14-alpha.3

### Patch Changes

- 8aa97c7: Show docs link in place of semantic recall + working memory in playground if they're not enabled

## 5.1.14-alpha.2

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- f6c4d75: fix date picker on change
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 09464dd: Share AgentMetadata component with cloud
- 65e3395: Add Scores playground-ui and add scorer hooks
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [4832752]
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [80c2b06]
- Updated dependencies [7ba91fa]
- Updated dependencies [6f6e651]
  - @mastra/client-js@0.10.15-alpha.2
  - @mastra/core@0.11.0-alpha.2

## 5.1.14-alpha.1

### Patch Changes

- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 59f0dcd: Add light background color for step statuses
- cf8d497: factorize tabs component between cloud and core
- 80692d5: refactor: sharing only the UI and not data fetching for traces
  - @mastra/core@0.11.0-alpha.1
  - @mastra/client-js@0.10.15-alpha.1

## 5.1.14-alpha.0

### Patch Changes

- 0bf0bc8: fix link in shared components + add e2e tests
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/client-js@0.10.15-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 5.1.13

### Patch Changes

- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 794d9f3: Fix thread creation in playground
- aa9528a: Display reasoning in playground
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents
- Updated dependencies [31f9f6b]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/client-js@0.10.14
  - @mastra/core@0.10.15

## 5.1.13-alpha.2

### Patch Changes

- 794d9f3: Fix thread creation in playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents

## 5.1.13-alpha.1

### Patch Changes

- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/client-js@0.10.14-alpha.1

## 5.1.13-alpha.0

### Patch Changes

- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- aa9528a: Display reasoning in playground
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- Updated dependencies [31f9f6b]
- Updated dependencies [db5cc15]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/client-js@0.10.14-alpha.0
  - @mastra/core@0.10.15-alpha.0

## 5.1.12

### Patch Changes

- 640f47e: move agent model settings into agent settings
- Updated dependencies [9468be4]
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
- Updated dependencies [44731a4]
  - @mastra/client-js@0.10.11
  - @mastra/core@0.10.12

## 5.1.12-alpha.0

### Patch Changes

- 640f47e: move agent model settings into agent settings
- Updated dependencies [9468be4]
- Updated dependencies [b4a9811]
- Updated dependencies [44731a4]
  - @mastra/client-js@0.10.11-alpha.0
  - @mastra/core@0.10.12-alpha.0

## 5.1.11

### Patch Changes

- 7fb0909: dependencies updates:
  - Updated dependency [`@dagrejs/dagre@^1.1.5` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.5) (from `^1.1.4`, in `dependencies`)
- 05ba777: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.1` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.1) (from `^12.6.4`, in `dependencies`)
- 7ccbf43: dependencies updates:
  - Updated dependency [`motion@^12.23.0` ↗︎](https://www.npmjs.com/package/motion/v/12.23.0) (from `^12.16.0`, in `dependencies`)
- 4b4b339: dependencies updates:
  - Updated dependency [`@uiw/react-codemirror@^4.23.14` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.14) (from `^4.23.13`, in `dependencies`)
- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- 4219597: add JSON input close to form input
- b790fd1: Use SerializedStepFlowEntry in playground
- c1cceea: Bump peerdeps of @matra/core
- a7a836a: Highlight send event button
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [18da791]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/client-js@0.10.10

## 5.1.11-alpha.4

### Patch Changes

- c1cceea: Bump peerdeps of @matra/core
  - @mastra/core@0.10.11-alpha.4
  - @mastra/client-js@0.10.10-alpha.4

## 5.1.11-alpha.3

### Patch Changes

- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3
  - @mastra/client-js@0.10.10-alpha.3

## 5.1.11-alpha.2

### Patch Changes

- 7fb0909: dependencies updates:
  - Updated dependency [`@dagrejs/dagre@^1.1.5` ↗︎](https://www.npmjs.com/package/@dagrejs/dagre/v/1.1.5) (from `^1.1.4`, in `dependencies`)
- 05ba777: dependencies updates:
  - Updated dependency [`@xyflow/react@^12.8.1` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.8.1) (from `^12.6.4`, in `dependencies`)
- 7ccbf43: dependencies updates:
  - Updated dependency [`motion@^12.23.0` ↗︎](https://www.npmjs.com/package/motion/v/12.23.0) (from `^12.16.0`, in `dependencies`)
- 4b4b339: dependencies updates:
  - Updated dependency [`@uiw/react-codemirror@^4.23.14` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.14) (from `^4.23.13`, in `dependencies`)
- 4219597: add JSON input close to form input
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
- Updated dependencies [18da791]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/client-js@0.10.10-alpha.2

## 5.1.11-alpha.1

### Patch Changes

- a7a836a: Highlight send event button
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1
  - @mastra/client-js@0.10.10-alpha.1

## 5.1.11-alpha.0

### Patch Changes

- b790fd1: Use SerializedStepFlowEntry in playground
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0
  - @mastra/client-js@0.10.10-alpha.0

## 5.1.10

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- 45f0dba: Display too-call finish reason error in playground
- Updated dependencies [b60f510]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/client-js@0.10.9
  - @mastra/core@0.10.10

## 5.1.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [b60f510]
- Updated dependencies [6997af1]
  - @mastra/client-js@0.10.9-alpha.1
  - @mastra/core@0.10.10-alpha.1

## 5.1.10-alpha.0

### Patch Changes

- 45f0dba: Display too-call finish reason error in playground
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0
  - @mastra/client-js@0.10.9-alpha.0

## 5.1.9

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- f78f399: Make AgentModelSettings shareable between cloud and playground
- Updated dependencies [9dda1ac]
- Updated dependencies [9047bda]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/client-js@0.10.8

## 5.1.9-alpha.0

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- ac369c6: Show resume data on workflow graph
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- f78f399: Make AgentModelSettings shareable between cloud and playground
- Updated dependencies [9dda1ac]
- Updated dependencies [9047bda]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/client-js@0.10.8-alpha.0

## 5.1.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/client-js@0.10.7

## 5.1.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/client-js@0.10.7-alpha.1

## 5.1.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/client-js@0.10.7-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 5.1.7

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- d569c16: dependencies updates:
  - Updated dependency [`react-code-block@1.1.3` ↗︎](https://www.npmjs.com/package/react-code-block/v/1.1.3) (from `1.1.1`, in `dependencies`)
- b9f5599: dependencies updates:
  - Updated dependency [`@codemirror/lang-json@^6.0.2` ↗︎](https://www.npmjs.com/package/@codemirror/lang-json/v/6.0.2) (from `^6.0.1`, in `dependencies`)
- 5af21a8: fix: remove final output on workflows for now
- 5d74aab: vNext network in playground
- 9102d89: Fix final output not showing on playground for previously suspended steps
- 21ffb97: Make dynamic form handle schema better
- be3d5a3: Remove recharts and ramada (unused deps)
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [18a5d59]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [bee3fe4]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [c0d41f6]
- Updated dependencies [0e17048]
  - @mastra/client-js@0.10.6
  - @mastra/core@0.10.7

## 5.1.7-alpha.7

### Patch Changes

- Updated dependencies [c0d41f6]
  - @mastra/client-js@0.10.6-alpha.6

## 5.1.7-alpha.6

### Patch Changes

- b9f5599: dependencies updates:
  - Updated dependency [`@codemirror/lang-json@^6.0.2` ↗︎](https://www.npmjs.com/package/@codemirror/lang-json/v/6.0.2) (from `^6.0.1`, in `dependencies`)
- 5af21a8: fix: remove final output on workflows for now
- Updated dependencies [bee3fe4]
  - @mastra/client-js@0.10.6-alpha.5
  - @mastra/core@0.10.7-alpha.5

## 5.1.7-alpha.5

### Patch Changes

- d569c16: dependencies updates:
  - Updated dependency [`react-code-block@1.1.3` ↗︎](https://www.npmjs.com/package/react-code-block/v/1.1.3) (from `1.1.1`, in `dependencies`)

## 5.1.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/client-js@0.10.6-alpha.4

## 5.1.7-alpha.3

### Patch Changes

- Updated dependencies [18a5d59]
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/client-js@0.10.6-alpha.3
  - @mastra/core@0.10.7-alpha.3

## 5.1.7-alpha.2

### Patch Changes

- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 5d74aab: vNext network in playground
- be3d5a3: Remove recharts and ramada (unused deps)
- Updated dependencies [8e1b6e9]
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/client-js@0.10.6-alpha.2
  - @mastra/core@0.10.7-alpha.2

## 5.1.7-alpha.1

### Patch Changes

- 21ffb97: Make dynamic form handle schema better
- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/client-js@0.10.6-alpha.1

## 5.1.7-alpha.0

### Patch Changes

- 9102d89: Fix final output not showing on playground for previously suspended steps
- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/client-js@0.10.6-alpha.0

## 5.1.6

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`@autoform/core@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/core/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@autoform/react@^3.1.0` ↗︎](https://www.npmjs.com/package/@autoform/react/v/3.1.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@autoform/zod@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/zod/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-avatar@^1.1.10` ↗︎](https://www.npmjs.com/package/@radix-ui/react-avatar/v/1.1.10) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-checkbox@^1.3.2` ↗︎](https://www.npmjs.com/package/@radix-ui/react-checkbox/v/1.3.2) (from `^1.1.4`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-collapsible@^1.1.11` ↗︎](https://www.npmjs.com/package/@radix-ui/react-collapsible/v/1.1.11) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-dialog@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-dialog/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-label@^2.1.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-label/v/2.1.7) (from `^2.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-popover@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-popover/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-scroll-area@^1.2.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-scroll-area/v/1.2.9) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-select@^2.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-select/v/2.2.5) (from `^2.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slider@^1.3.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slider/v/1.3.5) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slot@^1.2.3` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slot/v/1.2.3) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-switch@^1.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-switch/v/1.2.5) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tabs@^1.1.12` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tabs/v/1.1.12) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-toggle@^1.1.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-toggle/v/1.1.9) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tooltip@^1.2.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tooltip/v/1.2.7) (from `^1.1.8`, in `dependencies`)
  - Updated dependency [`@tanstack/react-table@^8.21.3` ↗︎](https://www.npmjs.com/package/@tanstack/react-table/v/8.21.3) (from `^8.21.2`, in `dependencies`)
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.23.13) (from `^4.23.10`, in `dependencies`)
  - Updated dependency [`@uiw/react-codemirror@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.13) (from `^4.23.8`, in `dependencies`)
  - Updated dependency [`@xyflow/react@^12.6.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.6.4) (from `^12.3.6`, in `dependencies`)
  - Updated dependency [`cmdk@^1.1.1` ↗︎](https://www.npmjs.com/package/cmdk/v/1.1.1) (from `^1.0.0`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.5.0`, in `dependencies`)
  - Updated dependency [`motion@^12.16.0` ↗︎](https://www.npmjs.com/package/motion/v/12.16.0) (from `^12.4.2`, in `dependencies`)
  - Updated dependency [`prism-react-renderer@^2.4.1` ↗︎](https://www.npmjs.com/package/prism-react-renderer/v/2.4.1) (from `^2.4.0`, in `dependencies`)
  - Updated dependency [`react-hook-form@^7.57.0` ↗︎](https://www.npmjs.com/package/react-hook-form/v/7.57.0) (from `^7.54.2`, in `dependencies`)
  - Updated dependency [`react-resizable-panels@^2.1.9` ↗︎](https://www.npmjs.com/package/react-resizable-panels/v/2.1.9) (from `^2.1.7`, in `dependencies`)
  - Updated dependency [`remark-rehype@^11.1.2` ↗︎](https://www.npmjs.com/package/remark-rehype/v/11.1.2) (from `^11.1.1`, in `dependencies`)
  - Updated dependency [`remeda@^2.23.0` ↗︎](https://www.npmjs.com/package/remeda/v/2.23.0) (from `^2.21.1`, in `dependencies`)
  - Updated dependency [`sonner@^2.0.5` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.5) (from `^2.0.1`, in `dependencies`)
  - Updated dependency [`use-debounce@^10.0.5` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.5) (from `^10.0.4`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Updated dependency [`zustand@^5.0.5` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.5) (from `^5.0.3`, in `dependencies`)
- 02560d4: lift evals fetching to the playground package instead
- 5f2aa3e: Move workflow hooks to playground
- 311132e: move useWorkflow to playground instead of playground-ui
- fc677d7: For final result for a workflow
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/client-js@0.10.5
  - @mastra/core@0.10.6

## 5.1.6-alpha.5

### Patch Changes

- 5f2aa3e: Move workflow hooks to playground
- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/client-js@0.10.5-alpha.5

## 5.1.6-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4
  - @mastra/client-js@0.10.5-alpha.4

## 5.1.6-alpha.3

### Patch Changes

- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3
  - @mastra/client-js@0.10.5-alpha.3

## 5.1.6-alpha.2

### Patch Changes

- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2
  - @mastra/client-js@0.10.5-alpha.2

## 5.1.6-alpha.1

### Patch Changes

- fc677d7: For final result for a workflow
- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/client-js@0.10.5-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 5.1.6-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@ai-sdk/ui-utils@^1.2.11` ↗︎](https://www.npmjs.com/package/@ai-sdk/ui-utils/v/1.2.11) (from `^1.1.19`, in `dependencies`)
  - Updated dependency [`@autoform/core@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/core/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@autoform/react@^3.1.0` ↗︎](https://www.npmjs.com/package/@autoform/react/v/3.1.0) (from `^3.0.0`, in `dependencies`)
  - Updated dependency [`@autoform/zod@^2.2.0` ↗︎](https://www.npmjs.com/package/@autoform/zod/v/2.2.0) (from `^2.1.0`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-avatar@^1.1.10` ↗︎](https://www.npmjs.com/package/@radix-ui/react-avatar/v/1.1.10) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-checkbox@^1.3.2` ↗︎](https://www.npmjs.com/package/@radix-ui/react-checkbox/v/1.3.2) (from `^1.1.4`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-collapsible@^1.1.11` ↗︎](https://www.npmjs.com/package/@radix-ui/react-collapsible/v/1.1.11) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-dialog@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-dialog/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-label@^2.1.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-label/v/2.1.7) (from `^2.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-popover@^1.1.14` ↗︎](https://www.npmjs.com/package/@radix-ui/react-popover/v/1.1.14) (from `^1.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-scroll-area@^1.2.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-scroll-area/v/1.2.9) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-select@^2.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-select/v/2.2.5) (from `^2.1.6`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slider@^1.3.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slider/v/1.3.5) (from `^1.2.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-slot@^1.2.3` ↗︎](https://www.npmjs.com/package/@radix-ui/react-slot/v/1.2.3) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-switch@^1.2.5` ↗︎](https://www.npmjs.com/package/@radix-ui/react-switch/v/1.2.5) (from `^1.1.3`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tabs@^1.1.12` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tabs/v/1.1.12) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-toggle@^1.1.9` ↗︎](https://www.npmjs.com/package/@radix-ui/react-toggle/v/1.1.9) (from `^1.1.2`, in `dependencies`)
  - Updated dependency [`@radix-ui/react-tooltip@^1.2.7` ↗︎](https://www.npmjs.com/package/@radix-ui/react-tooltip/v/1.2.7) (from `^1.1.8`, in `dependencies`)
  - Updated dependency [`@tanstack/react-table@^8.21.3` ↗︎](https://www.npmjs.com/package/@tanstack/react-table/v/8.21.3) (from `^8.21.2`, in `dependencies`)
  - Updated dependency [`@uiw/codemirror-theme-dracula@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/codemirror-theme-dracula/v/4.23.13) (from `^4.23.10`, in `dependencies`)
  - Updated dependency [`@uiw/react-codemirror@^4.23.13` ↗︎](https://www.npmjs.com/package/@uiw/react-codemirror/v/4.23.13) (from `^4.23.8`, in `dependencies`)
  - Updated dependency [`@xyflow/react@^12.6.4` ↗︎](https://www.npmjs.com/package/@xyflow/react/v/12.6.4) (from `^12.3.6`, in `dependencies`)
  - Updated dependency [`cmdk@^1.1.1` ↗︎](https://www.npmjs.com/package/cmdk/v/1.1.1) (from `^1.0.0`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.5.0`, in `dependencies`)
  - Updated dependency [`motion@^12.16.0` ↗︎](https://www.npmjs.com/package/motion/v/12.16.0) (from `^12.4.2`, in `dependencies`)
  - Updated dependency [`prism-react-renderer@^2.4.1` ↗︎](https://www.npmjs.com/package/prism-react-renderer/v/2.4.1) (from `^2.4.0`, in `dependencies`)
  - Updated dependency [`react-hook-form@^7.57.0` ↗︎](https://www.npmjs.com/package/react-hook-form/v/7.57.0) (from `^7.54.2`, in `dependencies`)
  - Updated dependency [`react-resizable-panels@^2.1.9` ↗︎](https://www.npmjs.com/package/react-resizable-panels/v/2.1.9) (from `^2.1.7`, in `dependencies`)
  - Updated dependency [`remark-rehype@^11.1.2` ↗︎](https://www.npmjs.com/package/remark-rehype/v/11.1.2) (from `^11.1.1`, in `dependencies`)
  - Updated dependency [`remeda@^2.23.0` ↗︎](https://www.npmjs.com/package/remeda/v/2.23.0) (from `^2.21.1`, in `dependencies`)
  - Updated dependency [`sonner@^2.0.5` ↗︎](https://www.npmjs.com/package/sonner/v/2.0.5) (from `^2.0.1`, in `dependencies`)
  - Updated dependency [`use-debounce@^10.0.5` ↗︎](https://www.npmjs.com/package/use-debounce/v/10.0.5) (from `^10.0.4`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
  - Updated dependency [`zustand@^5.0.5` ↗︎](https://www.npmjs.com/package/zustand/v/5.0.5) (from `^5.0.3`, in `dependencies`)
- 02560d4: lift evals fetching to the playground package instead
- 311132e: move useWorkflow to playground instead of playground-ui
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/client-js@0.10.5-alpha.0
  - @mastra/core@0.10.6-alpha.0

## 5.1.5

### Patch Changes

- 13c97f9: Save run status, result and error in storage snapshot
- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5
  - @mastra/client-js@0.10.4

## 5.1.4

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- e719504: don't start posthog when the browser is Brave
- 5c68759: Update vite to fix CVE-2025-31125
- 29f1c91: revert: final step of workflow not working as expected
- 8f60de4: fix workflow output when the schema is a primitive
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [b2810ab]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [67d21b5]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/client-js@0.10.3
  - @mastra/core@0.10.4

## 5.1.4-alpha.5

### Patch Changes

- 29f1c91: revert: final step of workflow not working as expected

## 5.1.4-alpha.4

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/client-js@0.10.3-alpha.3

## 5.1.4-alpha.3

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/client-js@0.10.3-alpha.2

## 5.1.4-alpha.2

### Patch Changes

- e719504: don't start posthog when the browser is Brave

## 5.1.4-alpha.1

### Patch Changes

- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/client-js@0.10.3-alpha.1
  - @mastra/core@0.10.4-alpha.1

## 5.1.4-alpha.0

### Patch Changes

- 5c68759: Update vite to fix CVE-2025-31125
- 8f60de4: fix workflow output when the schema is a primitive
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [b2810ab]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
- Updated dependencies [67d21b5]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/client-js@0.10.3-alpha.0

## 5.1.3

### Patch Changes

- 6303367: Fixed an issue where a recent memory images in playground fix broke playground tool calls

## 5.1.3-alpha.0

### Patch Changes

- 6303367: Fixed an issue where a recent memory images in playground fix broke playground tool calls

## 5.1.2

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- 9666468: move the fetch traces call to the playground instead of playground-ui
- 89a69d0: add a way to go to the given trace of a workflow step
- 6fd77b5: add docs and txt support for multi modal
- 9faee5b: small fixes in the workflows graph
- 4b23936: fix: typos
- 631683f: move workflow runs list in playground-ui instead of playground
- 068b850: fix: able to pass headers to playground components which are using the mastra client
- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- 9a31c09: Highlight steps in nested workflows on workflow graph
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [b72c768]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/client-js@0.10.2

## 5.1.2-alpha.7

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [b72c768]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/client-js@0.10.2-alpha.3

## 5.1.2-alpha.6

### Patch Changes

- 6fd77b5: add docs and txt support for multi modal
- 631683f: move workflow runs list in playground-ui instead of playground
- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6

## 5.1.2-alpha.5

### Patch Changes

- 9666468: move the fetch traces call to the playground instead of playground-ui
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5

## 5.1.2-alpha.4

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- 4b23936: fix: typos

## 5.1.2-alpha.3

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/client-js@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.4

## 5.1.2-alpha.2

### Patch Changes

- 068b850: fix: able to pass headers to playground components which are using the mastra client
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
  - @mastra/core@0.10.2-alpha.3

## 5.1.2-alpha.1

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- Updated dependencies [1e8bb40]
- Updated dependencies [f0d559f]
  - @mastra/core@0.10.2-alpha.2
  - @mastra/client-js@0.10.2-alpha.1

## 5.1.2-alpha.0

### Patch Changes

- 89a69d0: add a way to go to the given trace of a workflow step
- 9faee5b: small fixes in the workflows graph
- 9a31c09: Highlight steps in nested workflows on workflow graph
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/client-js@0.10.2-alpha.0
  - @mastra/core@0.10.2-alpha.0

## 5.1.1

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- 3c2dba5: add workflow run list
- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 33f1c64: revamp the experience for workflows
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- 7a32205: add empty states for workflows, agents and mcp servers
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [267773e]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [f622cfa]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1
  - @mastra/client-js@0.10.1

## 5.1.1-alpha.5

### Patch Changes

- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- Updated dependencies [267773e]
  - @mastra/client-js@0.10.1-alpha.3

## 5.1.1-alpha.4

### Patch Changes

- 3c2dba5: add workflow run list
- 33f1c64: revamp the experience for workflows
- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3

## 5.1.1-alpha.3

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/client-js@0.10.1-alpha.2
  - @mastra/core@0.10.1-alpha.2

## 5.1.1-alpha.2

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1
  - @mastra/client-js@0.10.1-alpha.1

## 5.1.1-alpha.1

### Patch Changes

- 7a32205: add empty states for workflows, agents and mcp servers

## 5.1.1-alpha.0

### Patch Changes

- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [f622cfa]
  - @mastra/core@0.10.1-alpha.0
  - @mastra/client-js@0.10.1-alpha.0

## 5.1.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 99552bc: revamp the UI of the tools page
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- fd69cc3: revamp UI of workflow "Run" pane
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [ccdabdc]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a6e3881]
- Updated dependencies [fddae56]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [5063646]
- Updated dependencies [2672a05]
  - @mastra/client-js@0.10.0
  - @mastra/core@0.10.0

## 5.1.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- fd69cc3: revamp UI of workflow "Run" pane
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0215b0b]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [5063646]
  - @mastra/client-js@0.2.0-alpha.1
  - @mastra/core@0.10.0-alpha.1

## 5.0.5-alpha.0

### Patch Changes

- 99552bc: revamp the UI of the tools page
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [ccdabdc]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [a6e3881]
- Updated dependencies [fddae56]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/client-js@0.1.23-alpha.0
  - @mastra/core@0.9.5-alpha.0

## 5.0.4

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c2f9e60]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [b4c6c87]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [c2b980b]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/client-js@0.1.22

## 5.0.4-alpha.4

### Patch Changes

- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/client-js@0.1.22-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 5.0.4-alpha.3

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c2f9e60]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [0c3d117]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/client-js@0.1.22-alpha.3

## 5.0.4-alpha.2

### Patch Changes

- Updated dependencies [b4c6c87]
- Updated dependencies [3171b5b]
- Updated dependencies [c2b980b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/client-js@0.1.22-alpha.2
  - @mastra/core@0.9.4-alpha.2

## 5.0.4-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/client-js@0.1.22-alpha.1

## 5.0.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/client-js@0.1.22-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 5.0.3

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 62c9e7d: Fix disappearing tool calls in streaming
- d2dfc37: Fix autoform number form default value
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [36eb1aa]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [62c9e7d]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/client-js@0.1.21

## 5.0.3-alpha.1

### Patch Changes

- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [36eb1aa]
- Updated dependencies [9cd1a46]
- Updated dependencies [62c9e7d]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/client-js@0.1.21-alpha.1

## 5.0.3-alpha.0

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- d2dfc37: Fix autoform number form default value
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/client-js@0.1.21-alpha.0
  - @mastra/core@0.9.3-alpha.0

## 5.0.2

### Patch Changes

- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- 33b84fd: fix showing sig digits in trace / span duration
- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 5b43dd0: revamp ui for threads
- fba031f: Show traces for vNext workflow
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2429c74]
- Updated dependencies [fba031f]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/client-js@0.1.20
  - @mastra/core@0.9.2

## 5.0.2-alpha.6

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [2e4f8e9]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/client-js@0.1.20-alpha.6

## 5.0.2-alpha.5

### Patch Changes

- fba031f: Show traces for vNext workflow
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/client-js@0.1.20-alpha.5

## 5.0.2-alpha.4

### Patch Changes

- 5b43dd0: revamp ui for threads
- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/client-js@0.1.20-alpha.4

## 5.0.2-alpha.3

### Patch Changes

- 33b84fd: fix showing sig digits in trace / span duration
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/client-js@0.1.20-alpha.3

## 5.0.2-alpha.2

### Patch Changes

- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/client-js@0.1.20-alpha.2

## 5.0.2-alpha.1

### Patch Changes

- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
- Updated dependencies [2429c74]
  - @mastra/client-js@0.1.20-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 5.0.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/client-js@0.1.20-alpha.0
  - @mastra/core@0.9.2-alpha.0

## 5.0.1

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 70124e1: revamp the ui for traces
- 3b74a74: add badge for failure / successful traces
- 05806e3: revamp the UI of the chat in playground
- 926821d: Fix triggerSchema default not showing in workflow ui
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- ca665d3: fix the ui for smaller screen regarding traces
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- 5a66ced: add click on trace row
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1
  - @mastra/client-js@0.1.19

## 5.0.1-alpha.9

### Patch Changes

- ca665d3: fix the ui for smaller screen regarding traces

## 5.0.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/client-js@0.1.19-alpha.8

## 5.0.1-alpha.7

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/client-js@0.1.19-alpha.7

## 5.0.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/client-js@0.1.19-alpha.6

## 5.0.1-alpha.5

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/client-js@0.1.19-alpha.5

## 5.0.1-alpha.4

### Patch Changes

- 3b74a74: add badge for failure / successful traces
- 5a66ced: add click on trace row
- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/client-js@0.1.19-alpha.4

## 5.0.1-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3
  - @mastra/client-js@0.1.19-alpha.3

## 5.0.1-alpha.2

### Patch Changes

- 70124e1: revamp the ui for traces
- 926821d: Fix triggerSchema default not showing in workflow ui
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/client-js@0.1.19-alpha.2

## 5.0.1-alpha.1

### Patch Changes

- 05806e3: revamp the UI of the chat in playground
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [b50b9b7]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1
  - @mastra/client-js@0.1.19-alpha.1

## 5.0.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/client-js@0.1.19-alpha.0

## 5.0.0

### Patch Changes

- bdbde72: Sync DS components with Cloud
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0
  - @mastra/client-js@0.1.18

## 5.0.0-alpha.8

### Patch Changes

- bdbde72: Sync DS components with Cloud
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8
  - @mastra/client-js@0.1.18-alpha.8

## 5.0.0-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/client-js@0.1.18-alpha.7

## 5.0.0-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/client-js@0.1.18-alpha.6

## 5.0.0-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/client-js@0.1.18-alpha.5

## 5.0.0-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4
  - @mastra/client-js@0.1.18-alpha.4

## 5.0.0-alpha.3

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3
  - @mastra/client-js@0.1.18-alpha.3

## 4.0.5-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/client-js@0.1.18-alpha.2

## 4.0.5-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/client-js@0.1.18-alpha.1

## 4.0.5-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/client-js@0.1.18-alpha.0

## 4.0.4

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/client-js@0.1.17

## 4.0.4-alpha.6

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/client-js@0.1.17-alpha.5

## 4.0.4-alpha.5

### Patch Changes

- ed52379: enum-type trigger schemas could not be submitted in the Playground UI has been resolved.

## 4.0.4-alpha.4

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- 9b47dfa: Fix dynamic form for suspended workflow in playground ui
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4
  - @mastra/client-js@0.1.17-alpha.4

## 4.0.4-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/client-js@0.1.17-alpha.3

## 4.0.4-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/client-js@0.1.17-alpha.2

## 4.0.4-alpha.1

### Patch Changes

- f5451a4: bundle tokens as CJS in playground UI for tailwind usage
- 37bb612: Add Elastic-2.0 licensing for packages
- bc4acb3: updated traces to not be wrapped in traces object
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [bc4acb3]
  - @mastra/core@0.8.3-alpha.1
  - @mastra/client-js@0.1.17-alpha.1

## 4.0.4-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/client-js@0.1.17-alpha.0

## 4.0.3

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2
  - @mastra/client-js@0.1.16

## 4.0.3-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/client-js@0.1.16-alpha.0

## 4.0.2

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/client-js@0.1.15

## 4.0.2-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/client-js@0.1.15-alpha.0

## 4.0.1

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.1-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 4.0.0

### Patch Changes

- 5ae0180: Removed prefixed doc references
- a4a1151: Fix playground freezing when buffer is passed between steps
- 7bdbb64: Show no input when attributs are empty
- 9d13790: update playground-ui dynamic form, cleanups
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 8393832: Handle nested workflow view on workflow graph
- 23999d4: Add Design System tokens and components into playground ui
- 8076ecf: Unify workflow watch/start response
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [055c4ea]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [5646a01]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [bffd64f]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/client-js@0.1.14

## 4.0.0-alpha.9

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- 23999d4: Add Design System tokens and components into playground ui

## 4.0.0-alpha.8

### Patch Changes

- 055c4ea: Fix traces page showing e.reduce error
- Updated dependencies [055c4ea]
- Updated dependencies [bffd64f]
- Updated dependencies [8df4a77]
  - @mastra/client-js@0.1.14-alpha.8
  - @mastra/core@0.8.0-alpha.8

## 4.0.0-alpha.7

### Patch Changes

- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7
  - @mastra/client-js@0.1.14-alpha.7

## 4.0.0-alpha.6

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [a3f0e90]
- Updated dependencies [5646a01]
  - @mastra/core@0.8.0-alpha.6
  - @mastra/client-js@0.1.14-alpha.6

## 4.0.0-alpha.5

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/client-js@0.1.14-alpha.5

## 4.0.0-alpha.4

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/client-js@0.1.14-alpha.4

## 4.0.0-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 7bdbb64: Show no input when attributs are empty
- 8393832: Handle nested workflow view on workflow graph
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/client-js@0.1.14-alpha.3

## 4.0.0-alpha.2

### Patch Changes

- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/client-js@0.1.14-alpha.2

## 4.0.0-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/client-js@0.1.14-alpha.1

## 3.0.1-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/core@0.7.1-alpha.0
  - @mastra/client-js@0.1.14-alpha.0

## 3.0.0

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 2134786: Fix traces navigation not working in playground
- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [3811029]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0
  - @mastra/client-js@0.1.13

## 3.0.0-alpha.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 3.0.0-alpha.3

### Patch Changes

- 2134786: Fix traces navigation not working in playground
- Updated dependencies [160f88e]
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/client-js@0.1.13-alpha.3
  - @mastra/core@0.7.0-alpha.3

## 3.0.0-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/client-js@0.1.13-alpha.2

## 3.0.0-alpha.1

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [27439ad]
  - @mastra/core@0.7.0-alpha.1
  - @mastra/client-js@0.1.13-alpha.1

## 2.0.5-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
- Updated dependencies [0206617]
- Updated dependencies [3811029]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/client-js@0.1.13-alpha.0

## 2.0.4

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4
  - @mastra/client-js@0.1.12

## 2.0.4-alpha.1

### Patch Changes

- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/client-js@0.1.12-alpha.1

## 2.0.4-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [fb68a80]
- Updated dependencies [05ef3e0]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0
  - @mastra/client-js@0.1.12-alpha.0

## 2.0.3

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/client-js@0.1.11
  - @mastra/core@0.6.3

## 2.0.3-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/client-js@0.1.11-alpha.1

## 2.0.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/client-js@0.1.11-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 2.0.2

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2
  - @mastra/client-js@0.1.10

## 2.0.2-alpha.0

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/client-js@0.1.10-alpha.0

## 2.0.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- 9ba1e97: fix loading state for evals page
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1
  - @mastra/client-js@0.1.9

## 2.0.1-alpha.2

### Patch Changes

- 0850b4c: Watch and resume per run
- 5baf1ec: animate new traces
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2
  - @mastra/client-js@0.1.9-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: fix loading state for evals page
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [4356859]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/client-js@0.1.9-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/client-js@0.1.9-alpha.0

## 2.0.0

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/client-js@0.1.8

## 2.0.0-alpha.1

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/client-js@0.1.8-alpha.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/client-js@0.1.8-alpha.0

## 1.0.0

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- e5149bb: Fix playground-ui agent-evals tab-content
- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [960690d]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [8deb34c]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/client-js@0.1.7

## 1.0.0-alpha.12

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/client-js@0.1.7-alpha.12

## 1.0.0-alpha.11

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11
  - @mastra/client-js@0.1.7-alpha.11

## 1.0.0-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/client-js@0.1.7-alpha.10

## 1.0.0-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9
  - @mastra/client-js@0.1.7-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/client-js@0.1.7-alpha.8

## 1.0.0-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/client-js@0.1.7-alpha.7

## 1.0.0-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/client-js@0.1.7-alpha.6

## 1.0.0-alpha.5

### Patch Changes

- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5
  - @mastra/client-js@0.1.7-alpha.5

## 1.0.0-alpha.4

### Patch Changes

- d79aedf: Fix import/require paths in these package.json
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/client-js@0.1.7-alpha.4

## 1.0.0-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/client-js@0.1.7-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/client-js@0.1.7-alpha.2

## 1.0.0-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content
- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/client-js@0.1.7-alpha.1

## 1.0.0-alpha.0

### Patch Changes

- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [960690d]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/client-js@0.1.7-alpha.0

## 0.0.2

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4
  - @mastra/client-js@0.1.6

## 0.0.2-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/client-js@0.1.6-alpha.0

## 0.0.1

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/client-js@0.1.5

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/client-js@0.1.5-alpha.4

## 0.0.1-alpha.2

### Patch Changes

- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [7a64aff]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3
  - @mastra/client-js@0.1.5-alpha.3
