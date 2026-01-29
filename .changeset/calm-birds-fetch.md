---
'@mastra/client-js': minor
---

Added workspace client methods for interacting with workspace API endpoints.

**New methods on `MastraClient`:**

- `listWorkspaces()` - List all available workspaces
- `getWorkspace(workspaceId)` - Get a workspace client for a specific workspace
- `workspace.info()` - Get workspace info and capabilities
- `workspace.listFiles()` / `readFile()` / `writeFile()` / `delete()` / `mkdir()` / `stat()` - Filesystem operations
- `workspace.listSkills()` / `getSkill(name).details()` / `.listReferences()` / `.getReference()` - Skill management
- `workspace.search()` - Search indexed content

**Usage:**

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// List workspaces and get the first one
const { workspaces } = await client.listWorkspaces();
const workspace = client.getWorkspace(workspaces[0].id);

// Read a file
const { content } = await workspace.readFile('/docs/guide.md');

// List skills
const { skills } = await workspace.listSkills();

// Get skill details
const skill = workspace.getSkill('my-skill');
const details = await skill.details();

// Search content
const { results } = await workspace.search({ query: 'authentication', mode: 'hybrid' });
```
