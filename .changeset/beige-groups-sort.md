---
'@mastra/mcp': patch
---

**Improved**
- Updated `@modelcontextprotocol/sdk` from `^1.17.5` to `^1.27.1`.

**Deprecated**
- Deprecated prompt `version` usage in `@mastra/mcp`.
- Prompt versions are not part of MCP protocol behavior and will be removed.

**Migration**
- Use unique prompt names instead of prompt versions.
- Before: `client.prompts.get({ name: 'explain-code', version: 'v1', args })`
- After: `client.prompts.get({ name: 'explain-code-v1', args })`

- `MastraPrompt` is available for migration and is also deprecated.
