---
'@mastra/platform': minor
---

Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`. `PlatformMemory` uses `MASTRA_MEMORY_INSTANCE_ID`; `PlatformKnowledge` uses `MASTRA_KNOWLEDGE_INSTANCE_ID`. `PlatformKnowledge` reads the scope declarations its instance supplies, such as the ones Platform importers write to with their access rules, so a project's agents list, search and read imported pages without declaring them.

```ts
import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
```
