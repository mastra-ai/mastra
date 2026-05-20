---
'@mastra/core': minor
---

Added Harness v1 public types for sessions, events, config, and tool context so developers can start typing integrations against the new Harness and Session split.

```ts
import type { HarnessConfig, HarnessEvent, HarnessRequestContext, SessionRecord } from '@mastra/core/harness/v1';
```
