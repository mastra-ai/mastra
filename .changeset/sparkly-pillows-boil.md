---
'@mastra/react': minor
'@mastra/playground-ui': patch
---

Added React Query hooks for the Mastra client, grouped by domain under `@mastra/react/hooks/<domain>` (for example `agents`, `workflows`, `traces`, `metrics`, `datasets`, `memory`, `mcps`, `tools`). React apps can read and update Mastra data without writing their own fetching layer, and only load the hooks for the domains they import.

Shared query helpers such as `MastraQueryClientProvider` and the error helpers live in `@mastra/react/hooks/query`.

`@tanstack/react-query` is now an optional peer dependency. It is only needed when you import from `@mastra/react/hooks/*`; wrap your app in `QueryClientProvider` and `MastraReactProvider`.

```tsx
import { useAgents } from '@mastra/react/hooks/agents';
import { useWorkflows } from '@mastra/react/hooks/workflows';

const { data: agents, isLoading } = useAgents();
```
