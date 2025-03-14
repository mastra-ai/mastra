# @mastra/docs-mcp

A Model Context Protocol (MCP) server that provides AI assistants with direct access to Mastra.ai's complete knowledge base. This includes comprehensive documentation with MDX support, a collection of production-ready code examples, technical blog posts, and detailed package changelogs. The server integrates with popular AI development environments like Cursor and Windsurf, as well as Mastra agents, making it easy to build documentation-aware AI assistants that can provide accurate, up-to-date information about Mastra.ai's ecosystem.

## Installation

### In Cursor

Create or update `.cursor/mcp.json` in your project root:

```json
{
  "servers": {
    "mastra": {
      "command": "npx",
      "args": ["-y", "@mastra/docs-mcp"]
    }
  }
}
```

This will make all Mastra documentation tools available in your Cursor workspace.

### In Windsurf

Create or update `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mastra": {
      "command": "npx",
      "args": ["-y", "@mastra/docs-mcp"]
    }
  }
}
```

This will make all Mastra documentation tools available in your Windsurf workspace.

### In a Mastra Agent

```typescript
import { MCPConfiguration } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// Configure MCP with the docs server
const mcp = new MCPConfiguration({
  servers: {
    mastra: {
      command: 'npx',
      args: ['-y', '@mastra/docs-mcp'],
    },
  },
});

// Create an agent with access to all documentation tools
const agent = new Agent({
  name: 'Documentation Assistant',
  instructions: 'You help users find and understand Mastra.ai documentation.',
  model: openai('gpt-4'),
  tools: await mcp.getTools(),
});

// Or use toolsets dynamically in generate/stream
const response = await agent.stream('Show me the quick start example', {
  toolsets: await mcp.getToolsets(),
});
```

## Tools

### Documentation Tool (`mastraDocs`)

- Get Mastra.ai documentation by requesting specific paths
- Explore both general guides and API reference documentation
- Automatically lists available paths when a requested path isn't found

### Examples Tool (`mastraExamples`)

- Access code examples showing Mastra.ai implementation patterns
- List all available examples
- Get detailed source code for specific examples

### Blog Tool (`mastraBlog`)

- Access technical blog posts and articles
- Posts are properly formatted with code block handling
- Supports various date formats in blog metadata

### Changes Tool (`mastraChanges`)

- Access package changelogs
- List all available package changelogs
- Get detailed changelog content for specific packages
