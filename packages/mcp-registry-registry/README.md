# @mastra/mcp-registry-registry

`@mastra/mcp-registry-registry` aggregates public Model Context Protocol (MCP) registries into one searchable catalog. Use it to list registry providers or discover MCP servers without integrating each registry's API separately.

## Installation

```bash
npm install @mastra/mcp-registry-registry
```

## Usage

Import the catalog and filter it for the registry providers your application supports.

```typescript
import { registryData } from '@mastra/mcp-registry-registry';

const verifiedRegistries = registryData.registries.filter(registry => registry.tags?.includes('verified'));

for (const registry of verifiedRegistries) {
  console.log(`${registry.name}: ${registry.url}`);
}
```

## Documentation

This README is the package guide. The exported `registryData` catalog includes registry metadata and optional post-processors; the package's MCP server exposes that catalog through the `registryList` and `registryServers` tools.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/mcp-registry-registry/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
