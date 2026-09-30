---
'@mastra/playground-ui': minor
---

Added `WorkspaceTreeView`, a file browser for a workspace with a lazily loaded folder tree, combined file and skill search, and a file viewer that renders Markdown or syntax-highlighted code.

```tsx
import { WorkspaceTreeView } from '@mastra/playground-ui/domains/workspace';

<WorkspaceTreeView workspaceId="my-workspace" initialFile="/README.md" />;
```

The layout is also available as composable `Workspace.*` parts (`Root`, `Aside`, `AsideHeader`, `Search`, `Tree`, `ActiveFile`, `ActiveFileHeader`, `FilePath`, `ActiveFileContent`).

Also added a `FileIcon` to the design-system icon set.
