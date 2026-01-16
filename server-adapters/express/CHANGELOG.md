# @mastra/express

## 0.1.0-beta.17

### Patch Changes

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`4db4e9b`](https://github.com/mastra-ai/mastra/commit/4db4e9b0905e1a659215bd49e987b47005e281ec), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`2657fab`](https://github.com/mastra-ai/mastra/commit/2657fab795e72fae742e1e8fdd4644ebaec199e3), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22
  - @mastra/server@1.0.0-beta.22

## 0.1.0-beta.16

### Patch Changes

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`92854c5`](https://github.com/mastra-ai/mastra/commit/92854c581618694f76ca1ee9873f9a10121d03e8), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`92854c5`](https://github.com/mastra-ai/mastra/commit/92854c581618694f76ca1ee9873f9a10121d03e8), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21
  - @mastra/server@1.0.0-beta.21

## 0.1.0-beta.15

### Minor Changes

- Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:**
  - `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
  - Added optional `fields` parameter to request only specific fields for better performance
  - Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
  - Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)
  - Removed `/execution-result` API endpoints from server (breaking change)
  - Removed `runExecutionResult()` method from client SDK (breaking change)
  - Removed `GetWorkflowRunExecutionResultResponse` type from client SDK (breaking change)

  **Before:**

  ```typescript
  // Had to call two different methods for different data
  const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
  const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
  ```

  **After:**

  ```typescript
  // Single method returns everything
  const run = await workflow.getWorkflowRunById(runId);
  // Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

  // Request only specific fields for better performance (avoids expensive step fetching)
  const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

  // Skip nested workflow steps for faster response
  const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
  ```

  **Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.

### Patch Changes

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Fixed inconsistent query parameter handling across server adapters. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). Added internal helper `normalizeQueryParams` and `ParsedRequestParams` type to `@mastra/server` for adapter implementations.

  **Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

  **User impact:** None for typical usage - HTTP endpoints and client SDK behavior are unchanged. If you extend server adapter classes and override `getParams` or `parseQueryParams`, update your implementation to use `Record<string, string | string[]>` for query parameters.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20
  - @mastra/server@1.0.0-beta.20

## 0.1.0-beta.14

### Patch Changes

- Updated dependencies [[`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7)]:
  - @mastra/core@1.0.0-beta.19
  - @mastra/server@1.0.0-beta.19

## 0.1.0-beta.13

### Patch Changes

- Updated dependencies [[`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93)]:
  - @mastra/core@1.0.0-beta.18
  - @mastra/server@1.0.0-beta.18

## 0.1.0-beta.12

### Patch Changes

- Updated dependencies [[`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318)]:
  - @mastra/core@1.0.0-beta.17
  - @mastra/server@1.0.0-beta.17

## 0.1.0-beta.11

### Patch Changes

- Updated dependencies [[`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`0ff9edd`](https://github.com/mastra-ai/mastra/commit/0ff9edda410f5eadb6e73f5cadc4bf82a51c3bce), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f)]:
  - @mastra/core@1.0.0-beta.16
  - @mastra/server@1.0.0-beta.16

## 0.1.0-beta.10

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

- Fixed voice transcription endpoint ([#11348](https://github.com/mastra-ai/mastra/pull/11348))

  The voice transcription endpoint (`/api/agents/:agentId/voice/listen`) now correctly handles multipart/form-data requests for audio uploads rather than only parsing JSON request bodies.

  Both Express and Hono adapters now parse multipart/form-data bodies and handle JSON-encoded form fields.

  **Breaking change:** The server schema field for the transcription endpoint was renamed from `audioData` to `audio` to match the client SDK. If you are making direct API calls to the transcription endpoint (not using the SDK), you will need to update your request body to use `audio` instead of `audioData`.

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`632fdb8`](https://github.com/mastra-ai/mastra/commit/632fdb8b3cd9ff6f90399256d526db439fc1758b), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde), [`9d57c7e`](https://github.com/mastra-ai/mastra/commit/9d57c7ecc0b095a47d78508c6fc29127a92edeee)]:
  - @mastra/core@1.0.0-beta.15
  - @mastra/server@1.0.0-beta.15

## 0.0.2-beta.9

### Patch Changes

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`484b9fb`](https://github.com/mastra-ai/mastra/commit/484b9fb28fc2499020900080d75b26278300a124), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14
  - @mastra/server@1.0.0-beta.14

## 0.0.2-beta.8

### Patch Changes

- Updated dependencies [[`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497)]:
  - @mastra/core@1.0.0-beta.13
  - @mastra/server@1.0.0-beta.13

## 0.0.2-beta.7

### Patch Changes

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`5118f38`](https://github.com/mastra-ai/mastra/commit/5118f384a70b1166012fde3b901f3227870b1009), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`6375f52`](https://github.com/mastra-ai/mastra/commit/6375f52c219305abef6f2026b4eaf8ac2fa5f1c0), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176)]:
  - @mastra/core@1.0.0-beta.12
  - @mastra/server@1.0.0-beta.12

## 0.0.2-beta.6

### Patch Changes

- Updated dependencies [[`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/server@1.0.0-beta.11
  - @mastra/core@1.0.0-beta.11

## 0.0.2-beta.5

### Patch Changes

- ### Breaking Changes ([#11028](https://github.com/mastra-ai/mastra/pull/11028))
  - Renamed `RuntimeContext` type to `ServerContext` to avoid confusion with the user-facing `RequestContext` (previously called `RuntimeContext`)
  - Removed `playground` and `isDev` options from server adapter constructors - these only set context variables without any actual functionality

  ### Changes

  **@mastra/server**
  - Renamed `RuntimeContext` type to `ServerContext` in route handler types
  - Renamed `createTestRuntimeContext` to `createTestServerContext` in test utilities
  - Renamed `isPlayground` parameter to `isStudio` in `formatAgent` function

  **@mastra/hono**
  - Removed `playground` and `isDev` from `HonoVariables` type
  - Removed setting of `playground` and `isDev` context variables in middleware

  **@mastra/express**
  - Removed `playground` and `isDev` from `Express.Locals` interface
  - Removed setting of `playground` and `isDev` in response locals

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`26346be`](https://github.com/mastra-ai/mastra/commit/26346beb6e637a114d1dd2eaf5127512c5af84fd), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10
  - @mastra/server@1.0.0-beta.10

## 0.0.2-beta.4

### Patch Changes

- Add HonoApp interface to eliminate `as any` cast when passing Hono app to MastraServer. Users can now pass typed Hono apps directly without casting. ([#10846](https://github.com/mastra-ai/mastra/pull/10846))

  Fix example type issues in server-adapters

- Updated dependencies [[`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3)]:
  - @mastra/core@1.0.0-beta.9
  - @mastra/server@1.0.0-beta.9

## 0.0.2-beta.3

### Patch Changes

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8
  - @mastra/server@1.0.0-beta.8

## 0.0.2-beta.2

### Patch Changes

- Fix README and ChangeLog for hono and express adapters ([#10873](https://github.com/mastra-ai/mastra/pull/10873))

- Fix abort signal being prematurely aborted in Express adapter ([#10901](https://github.com/mastra-ai/mastra/pull/10901))

  The abort signal was being triggered when the request body was parsed by `express.json()` middleware, causing `agent.generate()` to return empty responses with 0 tokens. Changed from `req.on('close')` to `res.on('close')` to properly detect client disconnection instead of body consumption.

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`5fe71bc`](https://github.com/mastra-ai/mastra/commit/5fe71bc925dfce597df69c89241f33b378028c63), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7
  - @mastra/server@1.0.0-beta.7

## 0.0.2-beta.1

### Patch Changes

- Unified MastraServer API with MCP transport routes ([#10644](https://github.com/mastra-ai/mastra/pull/10644))

  **Breaking Changes:**
  - Renamed `HonoServerAdapter` to `MastraServer` in `@mastra/hono`
  - Renamed `ExpressServerAdapter` to `MastraServer` in `@mastra/express`
  - Configuration now passed to constructor instead of separate method calls
  - Renamed base class from `ServerAdapter` to `MastraServerBase` in `@mastra/server`

  **New Features:**
  - Added MCP transport routes (HTTP and SSE) to server adapters
  - MCP endpoints available at `/api/mcp/:serverId/mcp` (HTTP) and `/api/mcp/:serverId/sse` (SSE)
  - Added `express.json()` middleware compatibility for MCP routes
  - Moved authentication helpers from deployer to `@mastra/server/auth`

  **Testing:**
  - Added shared MCP route and transport test suites in `@internal/server-adapter-test-utils`
  - Added comprehensive MCP endpoint tests for both Hono and Express adapters
  - Added GitHub Actions workflow for server adapter CI testing

- Allow direct access to server app handle directly from Mastra instance. ([#10598](https://github.com/mastra-ai/mastra/pull/10598))

  ```ts
  // Before: HTTP request to localhost
  const response = await fetch(`http://localhost:5000/api/tools`);

  // After: Direct call via app.fetch()
  const app = mastra.getServerApp<Hono>();
  const response = await app.fetch(new Request('http://internal/api/tools'));
  ```

  - Added `mastra.getServerApp<T>()` to access the underlying Hono/Express app
  - Added `mastra.getMastraServer()` and `mastra.setMastraServer()` for adapter access
  - Added `MastraServerBase` class in `@mastra/core/server` for adapter implementations
  - Server adapters now auto-register with Mastra in their constructor

- Add stream data redaction to prevent sensitive information leaks in agent stream API responses. ([#10705](https://github.com/mastra-ai/mastra/pull/10705))

  The `stream` API endpoint now automatically redacts `request` data from stream chunks (`step-start`, `step-finish`, `finish`) which could contain system prompts, tool definitions, and API keys. Redaction is enabled by default and can be disabled for debugging/internal services via `streamOptions.redact`.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`5a9bafc`](https://github.com/mastra-ai/mastra/commit/5a9bafcaaa859898e954456e781a1552dc0ad4f1), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`e849603`](https://github.com/mastra-ai/mastra/commit/e849603a596269069f58a438b98449ea2770493d), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`60e6e0f`](https://github.com/mastra-ai/mastra/commit/60e6e0f2913bbb467c64a0013b50509cf5efeb38), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6
  - @mastra/server@1.0.0-beta.6

## 0.0.2-beta.0

### Patch Changes

- Extract routing from @deployer/server into server adapter packages. ([#10263](https://github.com/mastra-ai/mastra/pull/10263))
  New packages:
  - @mastra/express
  - @mastra/hono

  These packages support mastra server routes on express and hono respectively.
  Better abstractions will be built on top of these packages in the near future, enabling users to easily attach mastra routes to any existing server framework.

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`d3e89dd`](https://github.com/mastra-ai/mastra/commit/d3e89dd4fc31ae2804c4c7bd3e98113d069cf780), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c63fbba`](https://github.com/mastra-ai/mastra/commit/c63fbba1afdd61a01a994b7a69e52c9881baeaeb), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc)]:
  - @mastra/core@1.0.0-beta.5
  - @mastra/server@1.0.0-beta.5
