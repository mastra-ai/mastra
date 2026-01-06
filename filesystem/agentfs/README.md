# @mastra/filesystem-agentfs

AgentFS filesystem provider for Mastra workspaces - SQLite/Turso-backed persistent storage.

## Features

- **Persistent Storage** - Files stored in SQLite database
- **Portable** - Single file database, easy to backup and move
- **Turso Compatible** - Works with Turso cloud databases
- **POSIX-like** - Standard filesystem semantics
- **Atomic Operations** - Database-backed atomicity

## Installation

```bash
pnpm add @mastra/filesystem-agentfs
```

## Usage

### With Mastra Workspace

```typescript
import { Workspace } from '@mastra/core';
import { AgentFilesystem } from '@mastra/filesystem-agentfs';

const workspace = new Workspace({
  filesystem: new AgentFilesystem({ id: 'my-agent' }),
});

await workspace.init();

// File operations
await workspace.writeFile('/data/config.json', JSON.stringify({ key: 'value' }));
const content = await workspace.readFile('/data/config.json', { encoding: 'utf-8' });

await workspace.destroy();
```

### With an Agent

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core';
import { AgentFilesystem } from '@mastra/filesystem-agentfs';

const workspace = new Workspace({
  filesystem: new AgentFilesystem({ id: 'my-agent' }),
});
await workspace.init();

const agent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  model: openai('gpt-4'),
  workspace,
});

// Agent has access to workspace_read_file, workspace_write_file, etc.
```

### Standalone Usage

```typescript
import { AgentFilesystem } from '@mastra/filesystem-agentfs';

// Using agent ID (creates .agentfs/my-agent.db)
const fs = new AgentFilesystem({ id: 'my-agent' });

// Using explicit path
const fs = new AgentFilesystem({ path: './data/agent.db' });

await fs.init();

// POSIX-like operations
await fs.writeFile('/hello.txt', 'Hello World!');
const content = await fs.readFile('/hello.txt', { encoding: 'utf-8' });

await fs.mkdir('/data');
const entries = await fs.readdir('/');

await fs.destroy();
```

## Configuration Options

```typescript
interface AgentFilesystemOptions {
  /**
   * Unique identifier for the agent.
   * If provided without `path`, creates storage at `.agentfs/{id}.db`
   */
  id?: string;

  /**
   * Explicit path to the database file.
   * If provided, uses this path directly.
   */
  path?: string;

  /**
   * Human-readable name for this filesystem instance.
   */
  name?: string;
}
```

## API

The `AgentFilesystem` class implements the `WorkspaceFilesystem` interface:

| Method | Description |
|--------|-------------|
| `init()` | Initialize the filesystem (opens database) |
| `destroy()` | Close database connection |
| `readFile(path, options?)` | Read file contents |
| `writeFile(path, content, options?)` | Write content to file |
| `appendFile(path, content)` | Append content to file |
| `deleteFile(path, options?)` | Delete a file |
| `copyFile(src, dest, options?)` | Copy a file |
| `moveFile(src, dest, options?)` | Move/rename a file |
| `mkdir(path, options?)` | Create a directory |
| `rmdir(path, options?)` | Remove a directory |
| `readdir(path, options?)` | List directory contents |
| `exists(path)` | Check if path exists |
| `stat(path)` | Get file/directory stats |
| `isFile(path)` | Check if path is a file |
| `isDirectory(path)` | Check if path is a directory |

## How It Works

AgentFS stores files in a SQLite database using the [agentfs-sdk](https://github.com/tursodatabase/agentfs) from Turso. The database contains:

- **Inodes** - File/directory metadata (size, timestamps, permissions)
- **Data chunks** - File content stored in chunks for efficient large file handling
- **Directory entries** - Parent-child relationships between files/directories

This approach provides:
- Atomic file operations
- Easy backup (single file)
- Portability across systems
- No filesystem permission issues

## Comparison with LocalFilesystem

| Feature | AgentFilesystem | LocalFilesystem |
|---------|-----------------|-----------------|
| Storage | SQLite database | Disk folder |
| Portability | Single file | Directory tree |
| Backup | Copy one file | Copy directory |
| Turso support | ✅ Yes | ❌ No |
| Audit trail | Via database | Via disk |
| Performance | Good for small-medium files | Best for large files |

## License

Apache-2.0
