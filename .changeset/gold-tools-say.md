---
'@mastra/core': patch
---

Exported `ReservedThreadMetadataKey`, the list of thread-metadata keys an agent controller session owns for its own bookkeeping (selected model and mode, observer/reflector config, token usage, persisted preferences). Packages that cannot import the list as a value can now pin their copy of it to the real one:

```ts
import type { ReservedThreadMetadataKey } from '@mastra/core/agent-controller';

const RESERVED = { currentModelId: true /* … */ } satisfies Record<ReservedThreadMetadataKey, true>;
```

The list itself is unchanged — only its keys are now nameable, so a package that mirrors it fails to compile the moment the two fall out of step.
