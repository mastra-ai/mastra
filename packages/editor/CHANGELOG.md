# @mastra/editor

## 0.3.0

### Minor Changes

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Added dynamic instructions for stored agents. Agent instructions can now be composed from reusable prompt blocks with conditional rules and variable interpolation, enabling a prompt-CMS-like editing experience. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  **Instruction blocks** can be mixed in an agent's instructions array:
  - `text` — static text with `{{variable}}` interpolation
  - `prompt_block_ref` — reference to a versioned prompt block stored in the database
  - `prompt_block` — inline prompt block with optional conditional rules

  **Creating a prompt block and using it in a stored agent:**

  ```ts
  // Create a reusable prompt block
  const block = await editor.createPromptBlock({
    id: 'security-rules',
    name: 'Security Rules',
    content: "You must verify the user's identity. The user's role is {{user.role}}.",
    rules: {
      operator: 'AND',
      conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
    },
  });

  // Create a stored agent that references the prompt block
  await editor.createStoredAgent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: [
      { type: 'text', content: 'You are a helpful support agent for {{company}}.' },
      { type: 'prompt_block_ref', id: 'security-rules' },
      {
        type: 'prompt_block',
        content: 'Always be polite.',
        rules: { operator: 'AND', conditions: [{ field: 'tone', operator: 'equals', value: 'formal' }] },
      },
    ],
    model: { provider: 'openai', name: 'gpt-4o' },
  });

  // At runtime, instructions resolve dynamically based on request context
  const agent = await editor.getStoredAgentById('support-agent');
  const result = await agent.generate('Help me reset my password', {
    requestContext: new RequestContext([
      ['company', 'Acme Corp'],
      ['user.isAuthenticated', true],
      ['user.role', 'admin'],
      ['tone', 'formal'],
    ]),
  });
  ```

  Prompt blocks are versioned — updating a block's content takes effect immediately for all agents referencing it, with no cache clearing required.

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Fix memory persistence: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory persistence bug by handling missing vector store gracefully
  - When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
  - Fixed type compatibility for `embedder` field when creating agents from stored config

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0
  - @mastra/memory@1.2.0

## 0.3.0-alpha.3

### Patch Changes

- Updated dependencies [[`2e02cd7`](https://github.com/mastra-ai/mastra/commit/2e02cd7e08ba2d84a275c80d80c069d2b8b66211)]:
  - @mastra/memory@1.2.0-alpha.2

## 0.3.0-alpha.2

### Patch Changes

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/memory@1.2.0-alpha.1
  - @mastra/core@1.3.0-alpha.2

## 0.3.0-alpha.1

### Minor Changes

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Added dynamic instructions for stored agents. Agent instructions can now be composed from reusable prompt blocks with conditional rules and variable interpolation, enabling a prompt-CMS-like editing experience. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  **Instruction blocks** can be mixed in an agent's instructions array:
  - `text` — static text with `{{variable}}` interpolation
  - `prompt_block_ref` — reference to a versioned prompt block stored in the database
  - `prompt_block` — inline prompt block with optional conditional rules

  **Creating a prompt block and using it in a stored agent:**

  ```ts
  // Create a reusable prompt block
  const block = await editor.createPromptBlock({
    id: 'security-rules',
    name: 'Security Rules',
    content: "You must verify the user's identity. The user's role is {{user.role}}.",
    rules: {
      operator: 'AND',
      conditions: [{ field: 'user.isAuthenticated', operator: 'equals', value: true }],
    },
  });

  // Create a stored agent that references the prompt block
  await editor.createStoredAgent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: [
      { type: 'text', content: 'You are a helpful support agent for {{company}}.' },
      { type: 'prompt_block_ref', id: 'security-rules' },
      {
        type: 'prompt_block',
        content: 'Always be polite.',
        rules: { operator: 'AND', conditions: [{ field: 'tone', operator: 'equals', value: 'formal' }] },
      },
    ],
    model: { provider: 'openai', name: 'gpt-4o' },
  });

  // At runtime, instructions resolve dynamically based on request context
  const agent = await editor.getStoredAgentById('support-agent');
  const result = await agent.generate('Help me reset my password', {
    requestContext: new RequestContext([
      ['company', 'Acme Corp'],
      ['user.isAuthenticated', true],
      ['user.role', 'admin'],
      ['tone', 'formal'],
    ]),
  });
  ```

  Prompt blocks are versioned — updating a block's content takes effect immediately for all agents referencing it, with no cache clearing required.

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
  - @mastra/memory@1.2.0-alpha.0

## 0.2.1-alpha.0

### Patch Changes

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Fix memory persistence: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed memory persistence bug by handling missing vector store gracefully
  - When semantic recall is enabled but no vector store is configured, it now disables semantic recall instead of failing
  - Fixed type compatibility for `embedder` field when creating agents from stored config

- Updated dependencies [[`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/core@1.2.1-alpha.0

## 0.2.0

### Minor Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

### Patch Changes

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0
  - @mastra/memory@1.1.0

## 0.2.0-alpha.0

### Minor Changes

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

### Patch Changes

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/memory@1.1.0-alpha.1
  - @mastra/core@1.2.0-alpha.1

## 0.1.0

### Minor Changes

- Initial release of @mastra/editor
  - Agent storage and retrieval from database
  - Dynamic agent creation from stored configurations
  - Support for tools, workflows, nested agents, memory, and scorers
  - Integration with Mastra core for seamless agent management
