---
"@mastra/cli": patch
---

**Added** a new `ensureDependencies()` method to `DepsService` for batch installation of missing dependencies.

**Usage:**

```typescript
import { DepsService } from '@mastra/cli';

const depsService = new DepsService();

// Install multiple dependencies in a single batch
await depsService.ensureDependencies([
  { name: 'package-name' },
  { name: 'versioned-package', versionTag: '^1.0.0' },
  { name: 'conditional-package', when: shouldInstall }
]);
