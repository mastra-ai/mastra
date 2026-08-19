---
'@mastra/code-sdk': minor
---

Added a bounded Pi extension compatibility kernel to Mastra Code. Pi 0.84.2 extensions can load as owned plugin generations and contribute schema-validated tools with abort, progress, result, and text-render adaptation.

```ts
import { PluginManager } from '@mastra/code-sdk/plugins/manager';

const manager = new PluginManager({ projectRoot, homeDir });
await manager.reload();
const tools = manager.getPluginTools();
```

Mastra Code remains the runtime owner, preserves native tool precedence, and reports unsupported Pi capabilities instead of ignoring them.
