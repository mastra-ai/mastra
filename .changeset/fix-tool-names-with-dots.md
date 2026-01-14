---
'@mastra/core': patch
---

Fixed tool names with dots being incorrectly sanitized. Tools with IDs like `fs.readdir`, `weather.tool`, or provider tools like `openai.web_search` are now properly preserved instead of being converted to underscores (e.g., `fs_readdir`).

This fix ensures that:
- User-defined tools with dots in their names work correctly
- Provider-defined tools from OpenAI, Anthropic, and Google (which use dots in their IDs) function properly
- The LLM can successfully call tools by their original names

**Before:**
```typescript
const agent = new Agent({
  tools: {
    'fs.readdir': createTool({
      id: 'fs.readdir',
      // Tool would be silently renamed to 'fs_readdir', causing calls to fail
    })
  }
});
```

**After:**
```typescript
const agent = new Agent({
  tools: {
    'fs.readdir': createTool({
      id: 'fs.readdir',
      // Tool name is preserved as 'fs.readdir' and works correctly
    })
  }
});
```
