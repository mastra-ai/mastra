# Mastra Codemods

Mastra provides automated code transformations (codemods) to help upgrade your codebase when features are deprecated, removed, or changed between versions.

Codemods are transformations that run on your codebase programmatically, allowing you to apply many changes without manually editing every file.

## Quick Start

### Run Version-Specific Codemods

```sh
npx @mastra/codemod@beta v1
```

### Run Individual Codemods

To run a specific codemod:

```sh
npx @mastra/codemod@beta <codemod-name> <path>
```

Examples:

```sh
# Transform a specific file
npx @mastra/codemod@beta v1/mastra-core-imports src/mastra.ts

# Transform a directory
npx @mastra/codemod@beta v1/mastra-core-imports src/lib/

# Transform entire project
npx @mastra/codemod@beta v1/mastra-core-imports .
```

## Available Codemods

### v1 Codemods (v0 → v1 Migration)

| Codemod                              | Description                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `v1/agent-abort-signal`              | Moves `abortSignal` from `modelSettings` to top-level options in agent method calls                                |
| `v1/agent-generate-stream-v-next`    | Renames `agent.generateVNext()` → `agent.generate()` and `agent.streamVNext()` → `agent.stream()`                  |
| `v1/agent-processor-methods`         | Renames `agent.getInputProcessors()` → `agent.listInputProcessors()` and similar output processor methods          |
| `v1/agent-property-access`           | Transforms agent property access to method calls: `agent.llm` → `agent.getLLM()`                                   |
| `v1/agent-voice`                     | Moves agent voice methods to namespace: `agent.speak()` → `agent.voice.speak()`                                    |
| `v1/client-get-memory-thread`        | Updates `client.getMemoryThread(threadId, agentId)` to use object parameter                                        |
| `v1/client-offset-limit`             | Renames pagination properties from `offset`/`limit` to `page`/`perPage`                                            |
| `v1/client-sdk-types`                | Renames Client SDK types from Get\* to List\* pattern                                                              |
| `v1/client-to-ai-sdk-format`         | Renames `toAISdkFormat` to `toAISdkStream`                                                                         |
| `v1/evals-prebuilt-imports`          | Updates prebuilt scorer imports from `scorers/llm` and `scorers/code` to `scorers/prebuilt`                        |
| `v1/evals-run-experiment`            | Renames `runExperiment()` → `runEvals()` in imports and usages                                                     |
| `v1/evals-scorer-by-name`            | Renames `mastra.getScorerByName()` → `mastra.getScorerById()`                                                      |
| `v1/experimental-auth`               | Renames `experimental_auth` to `auth` in Mastra configuration                                                      |
| `v1/mastra-core-imports`             | Updates imports from `@mastra/core` to use new subpath imports                                                     |
| `v1/mastra-plural-apis`              | Renames Mastra plural API methods from get\* to list\*                                                             |
| `v1/mcp-get-tools`                   | Renames `mcp.getTools()` → `mcp.listTools()`                                                                       |
| `v1/mcp-get-toolsets`                | Renames `mcp.getToolsets()` → `mcp.listToolsets()`                                                                 |
| `v1/memory-message-v2-type`          | Renames `MastraMessageV2` type → `MastraDBMessage` in imports and usages                                           |
| `v1/memory-query-to-recall`          | Renames `memory.query()` → `memory.recall()`                                                                       |
| `v1/memory-vector-search-param`      | Renames `vectorMessageSearch` parameter → `vectorSearchString` in `memory.recall()` calls                          |
| `v1/runtime-context`                 | Renames `RuntimeContext` to `RequestContext` and updates parameter names from `runtimeContext` to `requestContext` |
| `v1/storage-get-messages-paginated`  | Renames `storage.getMessagesPaginated()` → `storage.listMessages()` and `offset`/`limit` → `page`/`perPage`        |
| `v1/storage-get-threads-by-resource` | Renames `storage.getThreadsByResourceId()` → `storage.listThreadsByResourceId()`                                   |
| `v1/storage-list-messages-by-id`     | Renames `storage.getMessagesById()` → `storage.listMessagesById()`                                                 |
| `v1/storage-list-workflow-runs`      | Renames `storage.getWorkflowRuns()` → `storage.listWorkflowRuns()`                                                 |
| `v1/storage-postgres-schema-name`    | Renames `schema` property → `schemaName` in PostgresStore constructor                                              |
| `v1/vector-pg-constructor`           | Converts `new PgVector(connectionString)` to `new PgVector({ connectionString })`                                  |
| `v1/voice-property-names`            | Renames voice property names in Agent configuration: `speakProvider` → `output`                                    |
| `v1/workflow-create-run-async`       | Renames `workflow.createRunAsync()` → `workflow.createRun()`                                                       |
| `v1/workflow-list-runs`              | Renames `workflow.getWorkflowRuns()` → `workflow.listWorkflowRuns()`                                               |
| `v1/workflow-run-count`              | Renames `context.runCount` → `context.retryCount` in step execution functions                                      |
| `v1/workflow-stream-vnext`           | Renames `streamVNext()`, `resumeStreamVNext()`, and `observeStreamVNext()`                                         |

## CLI Options

### Commands

```sh
npx @mastra/codemod@beta <command> [options]
```

**Available Commands:**

- `<codemod-name> <path>` - Apply specific codemod

### Global Options

- `--dry` - Preview changes without applying them
- `--print` - Print transformed code to stdout
- `--verbose` - Show detailed transformation logs

### Examples

```sh
# Show verbose output for specific codemod
npx @mastra/codemod@beta --verbose v1/mastra-core-imports src/

# Print transformed code for specific codemod
npx @mastra/codemod@beta --print v1/mastra-core-imports src/mastra.ts
```

## Contributing

### Adding New Codemods

1. Create the codemod in `src/codemods/<version>`
2. Add test fixtures in `src/test/__fixtures__/`
3. Create tests in `src/test/`
4. Use the scaffold script to generate boilerplate:

   ```sh
   pnpm scaffold
   ```

### Testing Codemods

First, navigate to the codemod directory:

```sh
cd packages/codemod
```

Then run the tests:

```sh
# Run all tests
pnpm test

# Run specific codemod tests
pnpm test mastra-core-imports

# Test in development
pnpm test:watch
```
