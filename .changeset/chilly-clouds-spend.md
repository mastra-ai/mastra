---
'@mastra/mcp': minor
---

Added Agent Skills over MCP. `MCPServer` serves skills to clients that support the MCP Skills extension, such as VS Code and ChatGPT, and `MCPClient` reads skills from MCP servers.

**Serve skills**

Each folder holding a `SKILL.md` is a skill. Clients list the skills, then load a skill's files when a task needs them. Serve them from a workspace filesystem, an object of file contents, or your own `SkillSource`. Skills served from a filesystem keep only each file's size and digest in memory and read the file again when a client asks for it.

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

When a skill lists its files, every file is checked against the size and digest the server listed for it, so a changed or unlisted file is refused. Skills with `resources: 'dynamic'` list no files, so their files come back with `verified: false`.

```ts
const { docsServer } = await mcp.skills.list();
const manifest = await mcp.skills.read('docsServer', docsServer[0]);
const reference = await mcp.skills.read('docsServer', docsServer[0], 'references/REFERENCE.md');
```
