---
'@mastra/mcp': minor
---

Add `onToolError: 'returnEnvelope'` for MCP clients that need the complete failed `CallToolResult`, including `isError`, `content`, `structuredContent`, and result metadata. Existing `onToolError: 'return'` behavior is unchanged: failed calls with structured content still return the bare structured value, while failures without it return the full result.

**Before**

`onToolError: 'return'` unwraps structured error data, so callers receive the bare value without a reliable `isError` signal.

```ts
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({
  id: 'recipe-client',
  servers: {
    recipes: {
      url: new URL('https://recipes.example.com/mcp'),
      onToolError: 'return',
    },
  },
});

const tools = await mcp.listTools();
const result = await tools.recipes_submitRecipe.execute?.({ title: 'Soup' });

if (result.code === 'VALIDATION_FAILED') {
  // Handle the bare structured error without a protocol-level failure signal.
}
```

**After**

Use `onToolError: 'returnEnvelope'` to inspect the protocol failure signal, content blocks, and structured error details together.

```ts
import { MCPClient } from '@mastra/mcp';

const mcp = new MCPClient({
  id: 'recipe-client',
  servers: {
    recipes: {
      url: new URL('https://recipes.example.com/mcp'),
      onToolError: 'returnEnvelope',
    },
  },
});

const tools = await mcp.listTools();
const result = await tools.recipes_submitRecipe.execute?.({ title: 'Soup' });

if (result.isError) {
  const content = result.content;
  const errorDetails = result.structuredContent;
}
```

With `onToolError: 'throw'`, caught `MastraError` instances now include JSON-serialized structured error data in `details.structuredContent`.
