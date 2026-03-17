---
'@mastra/memory': patch
---

Improved observational memory cache stability by splitting persisted observations into separate prompt chunks using dated message boundary delimiters.

Added `getObservationsAsOf()` utility to retrieve the observations that were active at a specific point in time. This enables filtering observation history by message creation date.

```ts
import { getObservationsAsOf } from '@mastra/memory';

// Get observations that existed when a specific message was created
const observations = getObservationsAsOf(record.activeObservations, message.createdAt);
```
