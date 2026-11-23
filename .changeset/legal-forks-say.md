---
'@mastra/code-sdk': patch
---

Fixed Mastra Code staying silent when its local embedder package `@mastra/fastembed` can't be loaded. Headless runs now print one `Warning: Memory recall is off: ...` line to stderr in every output mode, saying recall search won't work until Mastra Code is reinstalled. The exit code and stdout don't change.

Embedding now fails with a typed `EmbedderPackageMissingError` (code `MASTRACODE_EMBEDDER_PACKAGE_MISSING`). Apps that embed Mastra Code can show the same notice once:

```typescript
import { isEmbedderPackageMissingError, onEmbedderPackageMissing } from '@mastra/code-sdk/agents/fastembed-subprocess';

const stop = onEmbedderPackageMissing(error => {
  showWarning(error.message);
});

// Or check an error you caught yourself
if (isEmbedderPackageMissingError(error)) {
  offerReinstall(error.packageName);
}

stop();
```
