---
'@internal/playground': patch
---

Fixed a Studio crash that surfaced as `No QueryClient set, use QueryClientProvider to set one` (most visibly on the Metrics page) when the workspace ended up with more than one React version installed. Multiple React copies caused `@tanstack/react-query` to be duplicated in the playground bundle, which split the QueryClient context between provider and consumers. The Vite build now dedupes `@tanstack/react-query`, so a single QueryClient context is shared across the bundle regardless of how many React copies pnpm produces.
