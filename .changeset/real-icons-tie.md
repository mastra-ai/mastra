---
'@mastra/core': minor
'@mastra/editor': minor
---

**Added stored scorer definitions, editor namespace pattern, and generic storage domains**

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
