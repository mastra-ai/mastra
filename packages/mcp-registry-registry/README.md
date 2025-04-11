# @mastra/mcp-registry-registry

An MCP server for registry registry services.

## Overview

This package provides a Model Context Protocol (MCP) server that exposes registry-related functionality through a standardized interface. It can be used to interact with registry services via LLM tools.

## Installation

```bash
pnpm add @mastra/mcp-registry-registry
```

## Usage

### As a CLI

```bash
npx @mastra/mcp-registry-registry
```

### As a library

```typescript
import { server } from '@mastra/mcp-registry-registry';

// Use the server instance
```

## Development

### Building

```bash
pnpm build:cli
```

### Testing

```bash
pnpm test
```

## Available Tools

- `registryHello`: A simple greeting tool that demonstrates the basic functionality of the registry registry service.

## License

Elastic-2.0
