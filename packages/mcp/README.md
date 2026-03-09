# @mastra/mcp

Mastra supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro), an open standard for connecting AI agents to external tools and resources. It serves as a universal plugin system, enabling agents to call tools regardless of language or hosting environment.

Mastra can also be used to author MCP servers, exposing agents, tools, and other structured resources via the MCP interface. These can then be accessed by any system or agent that supports the protocol.

## Installation

To use MCP, install the required dependency:

```bash
npm install @mastra/mcp@latest
```

## Overview

Mastra currently supports two MCP classes:

- `MCPClient`: Connects to one or many MCP servers to access their tools, resources, prompts, and handle elicitation requests.
- `MCPServer`: Exposes Mastra tools, agents, workflows, prompts, and resources to MCP-compatible clients.

Read the [official MCP documentation](https://mastra.ai/docs/mcp/overview) to learn more.
