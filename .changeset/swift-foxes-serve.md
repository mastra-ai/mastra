---
'@mastra/server': minor
---

Added workspace API endpoints for filesystem operations, skill management, and content search.

**New endpoints:**

- `GET /workspaces` - List all workspaces (from Mastra instance and agents)
- `GET /workspaces/:workspaceId` - Get workspace info and capabilities
- `GET/POST/DELETE /workspaces/:workspaceId/fs/*` - Filesystem operations (read, write, list, delete, mkdir, stat)
- `GET /workspaces/:workspaceId/skills` - List available skills
- `GET /workspaces/:workspaceId/skills/:skillName` - Get skill details
- `GET /workspaces/:workspaceId/skills/:skillName/references` - List skill references
- `GET /workspaces/:workspaceId/search` - Search indexed content

**Usage:**

```typescript
// List workspaces
const { workspaces } = await fetch('/api/workspaces').then(r => r.json());
const workspaceId = workspaces[0].id;

// Read a file
const response = await fetch(`/api/workspaces/${workspaceId}/fs/read?path=/docs/guide.md`);
const { content } = await response.json();

// List skills
const skills = await fetch(`/api/workspaces/${workspaceId}/skills`).then(r => r.json());

// Search content
const results = await fetch(`/api/workspaces/${workspaceId}/search?query=authentication&mode=hybrid`)
  .then(r => r.json());
```
