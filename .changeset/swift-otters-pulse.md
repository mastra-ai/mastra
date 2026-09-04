---
'@mastra/connect': minor
---

Add live mode to `connect()`: `connect({ live: true })` returns a resolver compatible with an agent's dynamic `tools` argument, backed by a TTL cache (stale-while-revalidate, default 30s, configurable via `ttlMs`) over the project's platform connections. Integrations attached to — or detached from — the project on the Mastra platform are picked up (or dropped) by running agents without a server restart. The resolver also exposes `invalidate()` and `refresh()` for manual control. Configuration errors still throw eagerly at `connect()` time; per-integration problems (needs re-auth, ambiguity, not attached yet) downgrade to warn-and-skip so one bad integration never takes down the whole toolset.

```ts
import { Agent } from '@mastra/core/agent'
import { connect } from '@mastra/connect'

const agent = new Agent({
  // Resolved per generate/stream — newly attached integrations appear automatically.
  tools: connect({ live: true, ttlMs: 30_000 }),
  model: 'openai/gpt-5-mini',
})
```
