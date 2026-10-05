---
'@mastra/react': minor
'@mastra/playground-ui': patch
---

Added a `@mastra/react/hooks` entry with React Query hooks for the Mastra client (agents, workflows, traces, metrics, datasets, memory, MCP, tools and more), so React apps can read and update Mastra data without writing their own fetching layer.

`@tanstack/react-query` is now an optional peer dependency. It is only needed when you import from `@mastra/react/hooks`; wrap your app in `QueryClientProvider` and `MastraReactProvider`.

```tsx
import { useAgents } from '@mastra/react/hooks';

const { data: agents, isLoading } = useAgents();
```
