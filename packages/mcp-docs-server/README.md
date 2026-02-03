# @mastra/mcp-docs-server

The `@mastra/mcp-docs-server` package provides direct access to Mastra’s full knowledge base via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro). It works with Cursor, Windsurf, Cline, Claude Code, VS Code, Codex or any tool that supports MCP.

These tools are designed to help agents retrieve precise, task-specific information — whether you're adding a feature to an agent, scaffolding a new project, or exploring how something works.

## Usage

Follow the [official installation](https://mastra.ai/docs/getting-started/mcp-docs-server) instructions to add the MCP server to your agent.

## Tools

### Documentation Tool (`mastraDocs`)

- Get Mastra.ai documentation by requesting specific paths
- Explore both general guides and API reference documentation
- Automatically lists available paths when a requested path isn't found

### Migration Tool (`mastraMigration`)

- Get migration guidance for Mastra version upgrades and breaking changes
- Explore all available migration guides (e.g., upgrade-to-v1/, agentnetwork)
- List section headers to see what breaking changes are covered
- Fetch specific sections or entire migration guides
- Search across all migration guides by keywords

### Embedded Documentation Tools

Read documentation directly from installed `@mastra/*` packages in your `node_modules`:

> **Important**: All embedded docs tools require a `projectPath` parameter - the absolute path to your project directory (e.g., `"/Users/you/my-project"`). This ensures the tools can locate your `node_modules` directory.

#### `listInstalledMastraPackages`

- Lists all installed `@mastra/*` packages that have embedded documentation
- Use this to discover which packages are available in your project
- **Required parameter**: `projectPath` - absolute path to your project directory

#### `readMastraSourceMap`

- Reads the SOURCE_MAP.json for a package to discover all exported symbols
- Shows each export with its type definition and implementation file
- Supports filtering exports by name

#### `findMastraExport`

- Finds detailed information about a specific export (function, class, type, etc.)
- Returns the type definition file location and implementation code location
- Useful for finding exactly where something is defined

#### `readMastraEmbeddedDocs`

- Reads embedded documentation markdown files from a package
- Browse by topic (e.g., "agents", "workflows", "tools")
- Lists available topics if no specific topic is provided

#### `searchMastraEmbeddedDocs`

- Full-text search across all embedded documentation in installed packages
- Returns matching content with package and file context
- Useful for finding information across multiple packages
