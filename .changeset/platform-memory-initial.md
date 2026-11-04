---
'@mastra/platform': minor
---

Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY` and `MASTRA_MEMORY_INSTANCE_ID`.

```ts
import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
```
