---
'@mastra/core': minor
---

Make the workspace grep text-extension whitelist extensible. Added `.sas`, `.log`, and `.jsonl` to the built-in text extensions and MIME type map so they are searchable by default. Added an optional `textExtensions` option to `MastraFilesystemOptions` (exposed via `filesystem.isTextFile()`) so consumers can register additional text extensions. When an explicit file path is grepped but its extension isn't recognized as text, the grep summary now reports it as skipped so "no matches" is distinguishable from "never searched".

```ts
import { LocalFilesystem } from '@mastra/core/workspace';

// Register extra extensions as searchable text files
const filesystem = new LocalFilesystem({
  basePath: process.cwd(),
  textExtensions: ['.sasx', '.myext'],
});

filesystem.isTextFile('report.sasx'); // true
```
