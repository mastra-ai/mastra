---
'@mastra/core': minor
---

Added per-endpoint discovery features that observability storage can declare from `getFeatures()`: `entity-type-discovery`, `entity-name-discovery`, `service-name-discovery`, `environment-discovery`, `tag-discovery` and `metric-discovery`. The in-memory observability store now declares `metrics`, `logs` and discovery support.

Custom observability stores can declare what they support so Studio only calls those APIs:

```ts
import { ObservabilityStorage } from '@mastra/core/storage';

class MyObservabilityStore extends ObservabilityStorage {
  override getFeatures() {
    return ['logs', 'entity-name-discovery', 'tag-discovery'] as const;
  }
}
```
