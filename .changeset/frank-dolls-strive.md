---
'@mastra/core': minor
---

Added dataset snapshot format utilities to validate portable identities, preserve authored JSON fields and required item creation and update timestamps, and detect artifact changes with an integrity digest. These utilities do not read or write dataset storage. Both helpers accept a configurable `maxBytes` budget (4 MiB by default), independent of the artifact format and integrity digest.

```ts
import { parseDatasetSnapshot } from '@mastra/core/datasets';

const snapshot = parseDatasetSnapshot(artifactJson, { maxBytes: 8 * 1024 * 1024 });
```
