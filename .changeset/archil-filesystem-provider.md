---
'@mastra/archil': minor
---

Added `@mastra/archil` — an Archil filesystem provider for Mastra workspaces, backed by Archil's elastic, serverless filesystems for AI agents. Exposes `ArchilFilesystem` and the `archilFilesystemProvider` descriptor for `MastraEditor`, supporting creating disks, reading/writing files, running commands, and searching.

**Usage**

```typescript
import { archilFilesystemProvider } from '@mastra/archil';

// Register the provider with a MastraEditor, configuring it with either an
// existing disk or options to create one on init.
const provider = archilFilesystemProvider;

// { diskId: 'dsk-0123456789abcdef' } or { createDiskOptions: { ... } }
// apiKey falls back to the ARCHIL_API_KEY env var.
```
