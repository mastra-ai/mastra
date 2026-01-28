---
'@mastra/server': minor
---

Added workspace API endpoints for filesystem operations, skill management, and content search.

**New endpoints:**

- `GET /workspace` - Get workspace info and capabilities
- `GET/POST/DELETE /workspace/fs/*` - Filesystem operations (read, write, list, delete, mkdir, stat)
- `GET /workspace/skills` - List available skills
- `GET /workspace/skills/:name` - Get skill details
- `GET /workspace/skills/:name/references` - List skill references
- `POST /workspace/search` - Search indexed content

**Usage:**

```typescript
// Read a file
const response = await fetch('/api/workspace/fs/read?path=/docs/guide.md');
const { content } = await response.json();

// List skills
const skills = await fetch('/api/workspace/skills').then(r => r.json());

// Search content
const results = await fetch('/api/workspace/search', {
  method: 'POST',
  body: JSON.stringify({ query: 'authentication', mode: 'hybrid' }),
}).then(r => r.json());
```
