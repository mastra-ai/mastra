---
'@mastra/e2b': minor
---

**Default template now ships a current Node.js LTS with corepack enabled.** The e2b base image carries Node 20.9.0, old enough that corepack-fetched package managers crash on it — so a setup command like `pnpm i && pnpm build` failed out of the box. The default mountable template now installs a pinned Node 24.20.0 over the stale runtime and enables corepack with the download prompt disabled, so `pnpm` and `yarn` resolve to whatever a repository's `packageManager` field pins.

Pick a different release with the new `nodeVersion` option:

```typescript
import { createDefaultMountableTemplate } from '@mastra/e2b'

const { template, id } = createDefaultMountableTemplate({ nodeVersion: '22.23.2' })
```

The version is exact and identity-bearing: changing it builds a new template, so a version change can never silently reuse a build at the old runtime. Existing default and repo templates rebuild once on first use after upgrading.
