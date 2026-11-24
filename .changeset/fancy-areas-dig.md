---
'@mastra/code-sdk': minor
'@mastra/factory': patch
'mastracode': patch
---

`@mastra/fastembed` is now an optional peer dependency. When it is not installed, the default local embedder installs it with npm into a per-user features directory on first use.

Set `featureInstall: 'never'` to report it as unavailable instead, and listen with `onFeatureInstall` to show progress. When it can't be installed, embedding fails with `EmbedderPackageMissingError` as before, now with `installReason` set and a message that says to run `mastracode features install embeddings` rather than reinstall Mastra Code. Hosts that must not download at runtime should depend on `@mastra/fastembed` themselves.

```ts
import { createMastraCode, onFeatureInstall } from '@mastra/code-sdk';

onFeatureInstall(event => console.error(event.status, event.feature));
await createMastraCode({ featureInstall: 'auto' }); // or 'never'
```
