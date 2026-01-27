# @mastra/cloudflare-do

Cloudflare Durable Objects storage provider for Mastra. Uses the synchronous SqlStorage API available in Durable Objects to provide memory storage capabilities.

## Installation

```bash
pnpm add @mastra/cloudflare-do
```

## Usage

```typescript
import { DurableObject } from "cloudflare:workers";
import { DOStore } from "@mastra/cloudflare-do";

class AgentDurableObject extends DurableObject<Env> {
  private storage: DOStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = new DOStore({
      sql: ctx.storage.sql,
      tablePrefix: 'mastra_'
    });
  }

  async saveThread(thread: StorageThreadType) {
    const memory = await this.storage.getStore('memory');
    await memory?.saveThread({ thread });
  }
}
```

## Configuration

| Option | Type | Description |
|--------|------|-------------|
| `sql` | `SqlStorage` | The SqlStorage instance from `ctx.storage.sql` in your Durable Object |
| `tablePrefix` | `string` | Optional prefix for table names (alphanumeric and underscores only) |
| `disableInit` | `boolean` | When true, disables automatic table creation on first use |

## Storage Domains

The DOStore provides three storage domains:

- **memory**: Thread and message persistence for conversations
- **workflows**: Workflow run state and snapshot storage
- **scores**: Evaluation and scoring data storage

Access domains via `getStore()`:

```typescript
const memory = await storage.getStore('memory');
const workflows = await storage.getStore('workflows');
const scores = await storage.getStore('scores');
```

## Direct Domain Usage

You can also use individual storage domains directly:

```typescript
import { MemoryStorageDO, WorkflowsStorageDO, ScoresStorageDO } from "@mastra/cloudflare-do";

const memoryStorage = new MemoryStorageDO({
  sql: ctx.storage.sql,
  tablePrefix: 'mastra_'
});

await memoryStorage.init();
```

## Requirements

- Cloudflare Workers with Durable Objects enabled
- `@cloudflare/workers-types` ^4.0.0 as a peer dependency
