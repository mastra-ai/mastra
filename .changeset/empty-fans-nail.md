---
'@mastra/core': patch
---

Added a `feedback` observability storage feature so clients can identify whether a store supports the feedback APIs. Storage adapters that implement the feedback methods declare the feature to advertise support.

```ts
import { ObservabilityStorage } from '@mastra/core/storage';

class MyObservabilityStore extends ObservabilityStorage {
  public getFeatures() {
    return ['feedback'] as const;
  }
}
```
