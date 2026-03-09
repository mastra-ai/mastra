# @mastra/mcp-docs-server

Access Mastra's documentation via [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro). Works with Cursor, Windsurf, Cline, Claude Code, VS Code, Codex, or any MCP-compatible tool.

## Usage

Follow the [official installation](https://mastra.ai/docs/getting-started/mcp-docs-server) instructions.

## Tools

### `mastraDocs`

Fetch documentation from mastra.ai by path. Supports guides and API references.

### `mastraMigration`

Navigate migration guides for version upgrades. Supports directory browsing, section listing, and keyword search.

Read docs from installed `@mastra/*` packages in `node_modules`. All tools require `projectPath` parameter.

### `getMastraHelp`

Entry point showing all available documentation tools and recommended workflows.

### `listMastraPackages`

List installed `@mastra/*` packages with embedded documentation.

### `getMastraExports`

Explore package API surface - all classes, functions, types, and constants.

### `getMastraExportDetails`

Get TypeScript type definitions and optionally implementation source code for a specific export.

### `readMastraDocs`

Read topic-based guides and examples (agents, tools, workflows, memory, etc.).

### `searchMastraDocs`

Full-text search across all embedded documentation.

## Interactive Course

### `startMastraCourse`

Start or resume the interactive Mastra course. Requires email registration.

### `getMastraCourseStatus`

View course progress including completed lessons and steps.

### `startMastraCourseLesson`

Jump to a specific lesson by name.

### `nextMastraCourseStep`

Advance to the next step in the current lesson.

### `clearMastraCourseHistory`

Reset all course progress.

## Prompts

### `upgrade-to-v1`

Guided migration workflow from Mastra v0.x to v1.0. Optionally focus on a specific area (agent, tools, workflows, etc.).

### `migration-checklist`

Comprehensive checklist of all breaking changes for v1.0 migration.
