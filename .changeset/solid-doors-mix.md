---
'@mastra/pg': minor
'@mastra/libsql': minor
---

Runs stored with the experimental workflow `storageVersion: 2` option can now be written by several workers at once, as evented workflows and `createEventedAgent` do. Concurrent `foreach` iterations all save their results, and the store writes a full copy of the workflow state after 100 changes so loading a long run stays fast.

```ts
import { Mastra } from '@mastra/core';
import { createWorkflow } from '@mastra/core/workflows';
import { PostgresStore } from '@mastra/pg';

const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema,
  outputSchema,
  // Version 2 runs opt in explicitly
  options: { storageVersion: 2 },
});

// Every worker creates its own Mastra instance against the same database,
// so more than one of them can write the same run.
const mastra = new Mastra({
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL! }),
  workflows: { workflow },
});
```

If you stored version 2 runs with `@mastra/pg` 1.36.0-alpha.0 or `@mastra/libsql` 1.30.0-alpha.0, the store adds the columns this needs to the `mastra_workflow_runs` table on startup, and those runs keep working.
