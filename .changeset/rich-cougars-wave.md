---
'@mastra/core': patch
'mastracode': patch
---

**Fixed**
- `/skills` now lists skills before any message is sent.
- Dynamic workspace is cached after first resolution, so agent runs and slash commands share the same instance.

**Added**
- `Harness.resolveWorkspace()` to eagerly resolve a dynamic workspace on demand.

**Example**
```ts
const workspace = await harness.resolveWorkspace();
const skills = await workspace?.skills?.list();
```
