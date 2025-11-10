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

| Codemod                           | Description                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1/mastra-core-imports`          | Updates all imports from `@mastra/core` to use the new subpath imports. For v1, all exports except `Mastra` and `Config` have moved to subpaths.                                         |
| `v1/runtime-context`              | Renames `RuntimeContext` to `RequestContext` and updates all parameter names from `runtimeContext` to `requestContext` across all APIs, including string literals in middleware.         |
| `v1/agent-generate-stream-v-next` | Transforms Agent VNext methods: `agent.generateVNext()` → `agent.generate()` and `agent.streamVNext()` → `agent.stream()`                                                                |
| `v1/agent-get-agents`             | Transforms Mastra method: `mastra.getAgents()` → `mastra.listAgents()`                                                                                                                   |
| `v1/agent-processor-methods`      | Transforms Agent processor methods: `agent.getInputProcessors()` → `agent.listInputProcessors()` and `agent.getOutputProcessors()` → `agent.listOutputProcessors()`                      |
| `v1/agent-property-access`        | Transforms Agent property access to method calls: `agent.llm` → `agent.getLLM()`, `agent.tools` → `agent.getTools()`, `agent.instructions` → `agent.getInstructions()`                   |
| `v1/agent-voice`                  | Transforms Agent voice methods to use namespace: `agent.speak()` → `agent.voice.speak()`, `agent.listen()` → `agent.voice.listen()`, `agent.getSpeakers()` → `agent.voice.getSpeakers()` |
| `v1/evals-get-scorers`            | Transforms Mastra method: `mastra.getScorers()` → `mastra.listScorers()`                                                                                                                 |
| `v1/experimental-auth`            | Renames `experimental_auth` to `auth` in Mastra configuration                                                                                                                            |
| `v1/mcp-get-mcp-servers`          | Transforms Mastra method: `mastra.getMCPServers()` → `mastra.listMCPServers()`                                                                                                           |
| `v1/mcp-get-tools`                | Transforms MCPServer method: `mcp.getTools()` → `mcp.listTools()`                                                                                                                        |
| `v1/mcp-get-toolsets`             | Transforms MCPServer method: `mcp.getToolsets()` → `mcp.listToolsets()`                                                                                                                  |
| `v1/voice-property-names`         | Transforms voice property names in Agent configuration: `speakProvider` → `output`, `listenProvider` → `input`, `realtimeProvider` → `realtime`                                          |
| `v1/workflows-get-workflows`      | Transforms Mastra method: `mastra.getWorkflows()` → `mastra.listWorkflows()`                                                                                                             |

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
