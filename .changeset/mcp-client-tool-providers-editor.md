---
'@mastra/editor': minor
---

Added MCP client management, integration tools resolution, and built-in Composio and Arcade AI tool providers.

**MCP Client Namespace**

New `editor.mcpClient` namespace for managing stored MCP client configurations with full CRUD operations. Stored agents can reference MCP clients with per-server tool filtering.

**Integration Tools**

Stored agents now support an `integrationTools` conditional field that resolves tools from registered `ToolProvider` instances at hydration time:

```ts
import { MastraEditor } from '@mastra/editor';
import { ComposioToolProvider } from '@mastra/editor/composio';
import { ArcadeToolProvider } from '@mastra/editor/arcade';

const editor = new MastraEditor({
  // ...
  toolProviders: {
    composio: new ComposioToolProvider({ apiKey: '...' }),
    arcade: new ArcadeToolProvider({ apiKey: '...' }),
  },
});
```

**Built-in Tool Providers**

- `@mastra/editor/composio` — Composio tool provider with toolkit/tool discovery and execution via `@composio/core` and `@composio/mastra` SDKs
- `@mastra/editor/arcade` — Arcade AI tool provider with a pre-seeded catalog of 93 toolkits, tool discovery, and execution via `@arcadeai/arcadejs` SDK

Each provider is a separate entry point — importing `@mastra/editor` alone does not load any provider SDK code.
