---
'@mastra/react': minor
---

Added `useWorkspaceDirectories` to list several workspace folders at once. Each folder shares its cache entry with `useWorkspaceDirectory`.

```tsx
const listings = useWorkspaceDirectories({ workspaceId, paths: ['src', 'src/agents'] });
```
