# @mastra/sandbox-local

Local sandbox provider for Mastra workspaces. Runs code directly on the host machine.

⚠️ **Warning:** Only use for development. For production, use `@mastra/sandbox-computesdk`.

## Installation

```bash
pnpm add @mastra/sandbox-local
```

## Usage

```typescript
import { Workspace } from '@mastra/core';
import { LocalSandbox } from '@mastra/sandbox-local';

const workspace = new Workspace({
  sandbox: new LocalSandbox(),
});

await workspace.init();

// Execute code
const result = await workspace.executeCode('console.log("Hello!")', {
  runtime: 'node',
});
console.log(result.stdout); // "Hello!"

// Execute commands
const cmdResult = await workspace.executeCommand('echo', ['Hello', 'World']);
console.log(cmdResult.stdout); // "Hello World"
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | auto-generated | Unique identifier |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `timeout` | `number` | `30000` | Default timeout (ms) |
| `defaultRuntime` | `SandboxRuntime` | `'node'` | Default runtime |
| `shell` | `boolean` | `false` | Use shell for commands |
| `allowedCommands` | `string[]` | undefined | Restrict allowed commands |
| `env` | `Record<string, string>` | `{}` | Environment variables |

## Supported Runtimes

The sandbox auto-detects available runtimes on your system:

- `node` - Node.js
- `python` - Python 3
- `bash` - Bash shell
- `ruby` - Ruby
- `go` - Go
- `rust` - Rust
- `deno` - Deno
- `bun` - Bun

## License

Apache-2.0
