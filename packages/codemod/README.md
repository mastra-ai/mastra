# @mastra/codemod

Mastra codemods are automated source transformations for upgrading applications when APIs are deprecated, removed, or changed between releases. They apply repeatable migrations across individual files, directories, or an entire project.

## Installation

You do not need to install the package globally. Run codemods directly with `npx` from the project you want to update.

## Usage

Run every codemod for the v0-to-v1 migration:

```bash
npx @mastra/codemod v1
```

Run one codemod against a file, directory, or project:

```bash
npx @mastra/codemod <codemod-name> <path>

npx @mastra/codemod v1/mastra-core-imports src/mastra.ts
npx @mastra/codemod v1/mastra-core-imports src/
npx @mastra/codemod v1/mastra-core-imports .
```

## Documentation

### Available commands

Run `npx @mastra/codemod v1` to apply the complete v0-to-v1 migration, or use one of these names to run an individual transformation:

| Codemod                                               | Description                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `v1/agent-abort-signal`                               | Moves `abortSignal` from `modelSettings` to the top-level agent method options.         |
| `v1/agent-generate-stream-v-next`                     | Renames `generateVNext()` and `streamVNext()` to `generate()` and `stream()`.           |
| `v1/agent-processor-methods`                          | Renames agent processor getters to the corresponding list methods.                      |
| `v1/agent-property-access`                            | Converts direct agent property access, such as `agent.llm`, to getter methods.          |
| `v1/agent-voice`                                      | Moves agent voice methods, such as `speak()`, under the `voice` namespace.              |
| `v1/client-get-memory-thread`                         | Converts positional `getMemoryThread()` arguments to an options object.                 |
| `v1/client-msg-function-args`                         | Updates client agent methods to accept messages as their first argument.                |
| `v1/client-offset-limit`                              | Replaces `offset` and `limit` pagination with `page` and `perPage`.                     |
| `v1/client-sdk-types`                                 | Renames Client SDK `Get*` types to the `List*` naming pattern.                          |
| `v1/client-to-ai-sdk-format`                          | Renames `toAISdkFormat()` to `toAISdkStream()`.                                         |
| `v1/evals-prebuilt-imports`                           | Moves prebuilt scorer imports to `scorers/prebuilt`.                                    |
| `v1/evals-run-experiment`                             | Renames `runExperiment()` to `runEvals()`.                                              |
| `v1/evals-scorer-by-name`                             | Renames `getScorerByName()` to `getScorerById()`.                                       |
| `v1/experimental-auth`                                | Renames the `experimental_auth` Mastra option to `auth`.                                |
| `v1/mastra-core-imports`                              | Rewrites `@mastra/core` imports to use package subpaths.                                |
| `v1/mastra-plural-apis`                               | Renames plural Mastra `get*` APIs to `list*`.                                           |
| `v1/mcp-get-tools`                                    | Renames `mcp.getTools()` to `mcp.listTools()`.                                          |
| `v1/mcp-get-toolsets`                                 | Renames `mcp.getToolsets()` to `mcp.listToolsets()`.                                    |
| `v1/memory-message-v2-type`                           | Renames `MastraMessageV2` to `MastraDBMessage`.                                         |
| `v1/memory-query-to-recall`                           | Renames `memory.query()` to `memory.recall()`.                                          |
| `v1/memory-readonly-to-options`                       | Moves `memory.readOnly` to `memory.options.readOnly`.                                   |
| `v1/memory-vector-search-param`                       | Renames `vectorMessageSearch` to `vectorSearchString`.                                  |
| `v1/runtime-context`                                  | Renames `RuntimeContext` and `runtimeContext` to `RequestContext` and `requestContext`. |
| `v1/storage-get-messages-paginated`                   | Replaces `getMessagesPaginated()` with `listMessages()` and updates pagination.         |
| `v1/storage-get-threads-by-resource`                  | Renames `getThreadsByResourceId()` to `listThreadsByResourceId()`.                      |
| `v1/storage-list-messages-by-id`                      | Renames `getMessagesById()` to `listMessagesById()`.                                    |
| `v1/storage-list-threads-by-resource-to-list-threads` | Replaces `listThreadsByResourceId()` with `listThreads({ filter: { resourceId } })`.    |
| `v1/storage-list-workflow-runs`                       | Renames `getWorkflowRuns()` to `listWorkflowRuns()`.                                    |
| `v1/storage-postgres-schema-name`                     | Renames the PostgreSQL store's `schema` option to `schemaName`.                         |
| `v1/vector-pg-constructor`                            | Converts the `PgVector` connection string argument to an options object.                |
| `v1/voice-property-names`                             | Updates legacy agent voice configuration property names.                                |
| `v1/workflow-create-run-async`                        | Renames `workflow.createRunAsync()` to `workflow.createRun()`.                          |
| `v1/workflow-get-init-data`                           | Adds an explicit type argument to untyped `getInitData()` calls.                        |
| `v1/workflow-list-runs`                               | Renames `workflow.getWorkflowRuns()` to `workflow.listWorkflowRuns()`.                  |
| `v1/workflow-run-count`                               | Renames workflow step `runCount` to `retryCount`.                                       |
| `v1/workflow-stream-vnext`                            | Renames the vNext workflow stream, resume, and observe methods.                         |

For example:

```bash
npx @mastra/codemod v1/agent-generate-stream-v-next src/
npx @mastra/codemod v1/runtime-context src/
npx @mastra/codemod v1/workflow-create-run-async src/
```

### CLI options

```bash
npx @mastra/codemod <command> [options]
```

- `--dry` previews a transformation without writing files.
- `--print` writes transformed source to stdout.
- `--verbose` displays detailed transformation output.

```bash
npx @mastra/codemod --dry v1/mastra-core-imports src/
npx @mastra/codemod --print v1/mastra-core-imports src/mastra.ts
npx @mastra/codemod --verbose v1/runtime-context src/
```

### Contributing

Create new codemods in `src/codemods/<version>`, add input and output fixtures under `src/test/__fixtures__/`, and add the corresponding tests in `src/test/`. The package includes a scaffold command for generating the boilerplate:

```bash
cd packages/codemod
pnpm scaffold
```

### Testing

Run tests from `packages/codemod`:

```bash
pnpm test
pnpm test mastra-core-imports
pnpm test:watch
```

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/codemod/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
