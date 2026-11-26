---
'@mastra/mcp': minor
---

Added Agent Skills over MCP. `MCPServer` serves skills to clients that support the MCP Skills extension, such as VS Code and ChatGPT, and `MCPClient` reads skills from MCP servers.

**Serve skills**

Each folder holding a `SKILL.md` is a skill. Clients list the skills, then load a skill's files when a task needs them. Serve them from a workspace filesystem, an object of file contents, or your own `SkillSource`. Only each file's size and digest stay in memory; files are read when a client asks for them.

```ts
import { MCPServer } from '@mastra/mcp';
import { LocalFilesystem } from '@mastra/core/workspace';

const server = new MCPServer({
  id: 'docs-server',
  name: 'Docs Server',
  version: '1.0.0',
  tools: {},
  skills: { files: new LocalFilesystem({ basePath: './skills' }) },
});
```

**Read skills**

Every file is checked against the size and digest the server listed for it, so a changed or unlisted file is refused.

```ts
const { docsServer } = await mcp.skills.list();
const manifest = await mcp.skills.read('docsServer', docsServer[0]);
const reference = await mcp.skills.read('docsServer', docsServer[0], 'references/REFERENCE.md');
```
