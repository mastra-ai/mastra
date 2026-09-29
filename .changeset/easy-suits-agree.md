---
'@mastra/code-sdk': patch
---

Fixed: mastracode no longer writes session scorer results into the local mastra.db.

The outcome and efficiency scorers run on every session and stored a result row each time, but nothing in mastracode ever read those rows back, so they only made the database grow. Scorer results are now discarded after each run instead of being kept on disk or in memory.

**SDK change:** `createMastraCode().storage.getStore('scores')` now returns empty results from lookups and listings, including for scores already in the database. To read those older scores, open the database directly.

Before:

```ts
const { storage } = await createMastraCode();
const scores = await storage.getStore('scores');
const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
```

After:

```ts
import { LibSQLStore } from '@mastra/libsql';
import { getDatabasePath } from '@mastra/code-sdk/utils/project';

const store = new LibSQLStore({ id: 'mastra-code-scores', url: `file:${getDatabasePath()}` });
const scores = await store.getStore('scores');
const { scores: rows } = await scores!.listScoresByRunId({ runId, pagination: { page: 0, perPage: 50 } });
```

Part of #22056.
