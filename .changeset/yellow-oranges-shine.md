---
'@mastra/core': minor
---

Added two options to `ToolSearchProcessor` for cheaper, more cache-friendly tool discovery.

**`autoLoad`: one-turn discovery**

Set `search.autoLoad` so that `search_tools` activates the matching tools immediately, removing the separate `load_tool` round-trip. The model searches once and can call a discovered tool on its next turn instead of searching, loading, then calling. This cuts one model turn (and a full prompt replay) per discovery.

```typescript
import { ToolSearchProcessor } from '@mastra/core/processors';

const toolSearch = new ToolSearchProcessor({
  tools: allTools,
  search: { topK: 3, autoLoad: true },
});
```

**`storage`: opt-in `'context'` mode**

Choose where loaded-tool state lives. The default `'in-memory'` keeps the original behavior. The new opt-in `'context'` mode derives loaded tools from the conversation messages, so it is restart-safe, needs no memory configuration, and de-loads a tool once its discovery result is no longer in the messages.

```typescript
const toolSearch = new ToolSearchProcessor({
  tools: allTools,
  storage: 'context',
});
```

Both modes are cache-friendly when loading tools, since loads are append-only and keep the cached prompt prefix stable. The default `'in-memory'` store still shares a single `'default'` entry across anonymous (no thread ID) requests; use `storage: 'context'` to keep anonymous requests isolated and derive loaded tools from the conversation messages.
