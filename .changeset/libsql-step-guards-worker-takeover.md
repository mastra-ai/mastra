---
'@mastra/libsql': minor
---

Added worker takeover for evented and durable agents on libSQL storage. When a worker process stops in the middle of a run, another worker can pick up the step from a broker such as Redis Streams and finish the run, and the original caller gets the result. If the same step message arrives again late, it no longer overwrites a step that already finished, and a finished loop iteration keeps its saved result instead of running again.

Requires `@mastra/core` 1.86.0 or later. Older versions can leave a restarted loop stuck once libSQL guards its steps.

All processes must use the same database. When they run on more than one machine, use a libSQL server such as sqld or Turso. A database file only works when every process runs on the same machine, because SQLite file locking isn't reliable on network filesystems.

```ts
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

const agent = createEventedAgent({ agent: supportAgent });

export const mastra = new Mastra({
  storage: new LibSQLStore({ id: 'storage', url: process.env.LIBSQL_URL, authToken: process.env.LIBSQL_AUTH_TOKEN }),
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL }),
  agents: { [agent.id]: agent },
});
```

Evented workflow runs now keep a record in storage while they run, even when `shouldPersistSnapshot` returns `false`, so another worker can recover them.

Runs started on older versions can finish after upgrading, but don't have guaranteed crash recovery. An evented workflow run that was already running with `shouldPersistSnapshot` returning `false` has no stored record, so it fails at its next step after the upgrade. Let those runs finish before upgrading.
