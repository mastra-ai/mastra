# @mastra/filesystem-local

Local filesystem provider for Mastra workspaces. Stores files in a folder on the user's machine.

## Installation

```bash
pnpm add @mastra/filesystem-local
```

## Usage

```typescript
import { Workspace } from '@mastra/core';
import { LocalFilesystem } from '@mastra/filesystem-local';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
});

await workspace.init();

// File operations
await workspace.writeFile('/hello.txt', 'Hello World!');
const content = await workspace.readFile('/hello.txt', { encoding: 'utf-8' });

// Directory operations
await workspace.mkdir('/data');
const entries = await workspace.readdir('/');
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePath` | `string` | *required* | Base directory path on disk |
| `id` | `string` | auto-generated | Unique identifier |
| `sandbox` | `boolean` | `true` | Prevent path traversal attacks |

## Security

By default, all operations are sandboxed to the `basePath`. This prevents path traversal attacks like `/../../../etc/passwd`.

To disable sandboxing (not recommended):

```typescript
const fs = new LocalFilesystem({
  basePath: './workspace',
  sandbox: false,
});
```

## License

Apache-2.0
