---
'@mastra/core': minor
---

Added the Harness v1 storage contract for session records, leases, and attachments. Storage adapters can now provide durable session state for the new Harness and Session APIs.

```ts
import { Harness } from '@mastra/core/harness/v1';
import type { HarnessStorage } from '@mastra/core/storage/domains/harness';

const myHarnessStorage: HarnessStorage = createHarnessStorage();

const harness = new Harness({
  agents,
  modes,
  sessions: { storage: myHarnessStorage },
});
```
