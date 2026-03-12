---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Improved studio loading performance by splitting the playground-ui barrel export into domain-specific sub-path imports (e.g. `@mastra/playground-ui/agents`, `@mastra/playground-ui/workflows`). Combined with route-level code splitting, this reduces the initial bundle from 5.1MB to 3.1MB by only loading domain code needed for the current route.
