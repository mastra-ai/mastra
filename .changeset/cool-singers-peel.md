---
'mastracode': minor
---

Added TanStack Query data hooks for the web settings UI and a reusable, platform-agnostic shared/ module so a future React Native app can consume the same hooks and config. Provider, custom-provider, model-pack, observational-memory, and directory-picker panels now fetch through React Query with automatic request dedupe and cache invalidation instead of manual useEffect fetching. Streaming/SSE chat is unchanged.
