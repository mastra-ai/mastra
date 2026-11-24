---
'@mastra/mcp': minor
'@mastra/server-adapters-test-suite': patch
'@mastra/hono': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added Agent Skills over MCP. `MCPServer` serves skills to clients that support the MCP Skills extension, such as VS Code and ChatGPT, and `MCPClient` reads skills from MCP servers.

**Serve skills**

Each folder holding a `SKILL.md` is a skill. Clients list the skills, then load a skill's files when a task needs them.

```ts
import { MCPServer, readSkillFiles } from '@mastra/mcp';

const server = new MCPServer({
  id: 'docs-server',
  name: 'Docs Server',
  version: '1.0.0',
  tools: {},
  skills: { files: await readSkillFiles('./skills') },
});
```

**Read skills**

Every file is checked against the size and digest the server listed for it, so a changed or unlisted file is refused.

```ts
const { docsServer } = await mcp.skills.list();
const manifest = await mcp.skills.read('docsServer', docsServer[0]);
const reference = await mcp.skills.read('docsServer', docsServer[0], 'references/REFERENCE.md');
```
