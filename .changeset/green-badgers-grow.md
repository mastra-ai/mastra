---
'@mastra/factory': patch
---

Added a persisted `modelScope` field to Factory projects, defaulting to `factory` to preserve the existing Factory-level behavior. This release saves and exposes the selection for future support; it does not change session model or credential resolution.

Consumers can inspect the saved setting through the exported `FactoryProject` type:

```ts
import type { FactoryProject } from '@mastra/factory';

function usesFactoryDefaults(project: FactoryProject) {
  return project.modelScope === 'factory';
}
```
