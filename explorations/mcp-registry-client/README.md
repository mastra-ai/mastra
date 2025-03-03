# MCP Configuration Client

A POC implementation for managing Model Context Protocol (MCP) server configurations. This project provides tools for discovering, configuring, and managing MCP servers through two main classes:

- **RegistryClient**: Handles server discovery and provides type-safe server definitions
- **MCPConfiguration**: Manages server configurations with validation and persistence

## Core Components

### RegistryClient (`packages/mcp-registry`)

The RegistryClient provides server discovery and type-safe server definitions:

- Server discovery via `.well-known/mcp`
- Type-safe server definitions using TypeScript
- Configuration validation using Zod schemas
- Mock registry with real-world server examples

### MCPConfiguration (`packages/mcp-configuration`)

The MCPConfiguration class manages server configurations:

- Add/edit/remove server configurations
- Environment variable management
- Runtime argument handling
- Configuration persistence
- Validation against server schemas

## Examples

The project includes several examples demonstrating how to use these classes:

### 1. Basic Usage Examples

Several standalone examples demonstrating core functionality:

```bash
# Server discovery example
pnpm ex:discovery

# Configuration management example
pnpm ex:config

# Configuration validation example
pnpm ex:validate

# Tool usage example
pnpm ex:tool-use
```

Note: for running the tool-use example you must have an `OPENAI_API_KEY` env var set.

### 2. Terminal User Interface (TUI)

An example interactive terminal interface built using the core classes:

```bash
# Run the TUI example
pnpm ex:tui
```

Features:

- Browse available MCP servers
- View server details (license, downloads, description)
- Configure server settings
- Manage existing configurations

## Note

When we actually ship this as a feature we can simplify the API:

```ts
const mcp = new MCPConfiguration({
	registry: "https://mcp.run/.well-known/mcp",
	servers: {}, // <- allow hardcoding server configs. do something like what gql.tada does to magically add type definitions for available servers.
})
```

We might also want to think about the class being called something like `ToolsConfiguration` instead because it could be used to persist configs for other kinds of registries. We could also make the class work with our storage adapters

## Example Servers

The mock registry includes several reference implementations:

1. **Production Services**

   - `stripe`: Payment processing tools
   - `firecrawl`: Web scraping capabilities
   - `brave-search`: Web search API
   - `browserbase`: Browser automation

2. **Reference Implementations**
   - `filesystem-ref`: File system operations
   - `git-ref`: Git operations
   - `everything-ref`: Protocol feature testing

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Project Structure

- `packages/mcp-registry`: Core registry client implementation
- `packages/mcp-configuration`: Configuration management library
- `examples/basic-usage`: Standalone example scripts
- `examples/tui`: Interactive terminal interface example
