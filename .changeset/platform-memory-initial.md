---
'@mastra/platform': minor
---

Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`. `PlatformMemory` uses `MASTRA_MEMORY_INSTANCE_ID`; `PlatformKnowledge` uses `MASTRA_KNOWLEDGE_INSTANCE_ID`. `PlatformKnowledge` takes every scope declaration and access rule from its instance, Memory's and Platform importers' included, and has no `scopes` option. Agents read imported pages when their runs hold the scope an importer's rule grants (for now `imports:all`).

```ts
import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
```
