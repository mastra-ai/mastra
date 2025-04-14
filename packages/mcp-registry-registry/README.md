# @mastra/mcp-registry-registry

An MCP server that provides a registry of MCP registries, allowing discovery and access to MCP servers across multiple registries.

## Overview

The MCP Registry Registry serves as a meta-registry, aggregating information about various MCP registries and providing a unified interface to discover and access MCP servers across the ecosystem. This package implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.ai/) specification, making it compatible with any MCP client.

## Features

- **Registry Listing**: Browse and filter available MCP registries
- **Server Discovery**: Fetch servers from specific registries

## Installation

```bash
# Using npm
npm install @mastra/mcp-registry-registry

# Using pnpm
pnpm add @mastra/mcp-registry-registry

# Using yarn
yarn add @mastra/mcp-registry-registry
```

## Available Tools

### `registryList`

Lists available MCP registries with filtering options.

### `registryServers`

Fetches servers from a specific registry with filtering options.
