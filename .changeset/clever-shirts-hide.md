---
'@mastra/e2b': patch
'@mastra/gcs': patch
---

Added editor provider descriptors for workspace filesystem, sandbox, and blob store packages. Each provider exports an object with `id`, `name`, `description`, `configSchema` (JSON Schema), and a factory method, enabling the editor UI to auto-discover and render configuration forms for workspace providers.

- `@mastra/gcs`: Added `gcsFilesystemProvider` with config schema for bucket, projectId, credentials, prefix, readOnly, and endpoint
- `@mastra/e2b`: Added `e2bSandboxProvider` with config schema for template, timeout, env, metadata, runtimes, domain, and API settings

```ts
import { gcsFilesystemProvider } from '@mastra/gcs';
import { e2bSandboxProvider } from '@mastra/e2b';

const editor = new MastraEditor({
  filesystems: {
    gcs: gcsFilesystemProvider,
  },
  sandboxes: {
    e2b: e2bSandboxProvider,
  },
});

// Enumerate available providers and their config schemas for UI rendering
const fsProviders = editor.getFilesystemProviders();
const sbProviders = editor.getSandboxProviders();
```
