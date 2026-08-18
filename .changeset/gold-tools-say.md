---
'@mastra/core': patch
---

Exported `ReservedThreadMetadataKey`, the list of thread-metadata keys an agent controller session owns for its own bookkeeping (selected model and mode, observer/reflector config, token usage, persisted preferences). Packages that cannot import the list as a value can now pin their copy of it to the real one:

```ts
import type { ReservedThreadMetadataKey } from '@mastra/core/agent-controller';

const RESERVED = { currentModelId: true /* … */ } satisfies Record<ReservedThreadMetadataKey, true>;
```

A stale copy of that list is what let session preferences surface as thread tags over HTTP.
