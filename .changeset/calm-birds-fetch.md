---
'@mastra/client-js': minor
---

Added workspace client methods for interacting with workspace API endpoints.

**New methods on `MastraClient`:**

- `workspace.getInfo()` - Get workspace info and capabilities
- `workspace.fs.read()` / `write()` / `list()` / `delete()` / `mkdir()` / `stat()` - Filesystem operations
- `workspace.skills.list()` / `get()` / `getReferences()` / `getReferenceContent()` - Skill management
- `workspace.search()` - Search indexed content

**Usage:**

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// Read a file
const { content } = await client.workspace.fs.read({ path: '/docs/guide.md' });

// List skills
const { skills } = await client.workspace.skills.list();

// Search content
const { results } = await client.workspace.search({ query: 'authentication', mode: 'hybrid' });
```
