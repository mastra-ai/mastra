# @mastra/sandbox-computesdk

ComputeSDK sandbox provider for Mastra workspaces. Execute code securely in isolated cloud environments via E2B, Modal, Railway, Daytona, and more.

## Installation

```bash
pnpm add @mastra/sandbox-computesdk computesdk
```

## Quick Start

```typescript
import { Workspace } from '@mastra/core';
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

// Create a cloud-based sandbox using E2B
const workspace = new Workspace({
  sandbox: new ComputeSDKSandbox({
    provider: 'e2b',
    apiKey: process.env.COMPUTESDK_API_KEY,
  }),
});

// Initialize the workspace (starts the cloud sandbox)
await workspace.init();

// Execute Python code securely in the cloud
const result = await workspace.executeCode(
  'print("Hello from E2B!")',
  { runtime: 'python' }
);
console.log(result.stdout); // "Hello from E2B!"

// Clean up cloud resources
await workspace.destroy();
```

## Supported Providers

ComputeSDK supports multiple cloud sandbox providers:

| Provider    | Description                        | Env Variable               |
|-------------|------------------------------------|-----------------------------|
| `e2b`       | E2B cloud sandboxes                | `E2B_API_KEY`              |
| `modal`     | Modal compute                       | `MODAL_TOKEN_ID/SECRET`    |
| `railway`   | Railway environments                | `RAILWAY_API_KEY`          |
| `daytona`   | Daytona workspaces                  | `DAYTONA_API_KEY`          |
| `vercel`    | Vercel Functions sandbox            | `VERCEL_TOKEN`             |
| `runloop`   | Runloop sandboxes                   | `RUNLOOP_API_KEY`          |
| `cloudflare`| Cloudflare Workers                  | `CLOUDFLARE_API_TOKEN`     |
| `codesandbox`| CodeSandbox environments           | `CSB_API_KEY`              |
| `blaxel`    | Blaxel compute                      | `BL_API_KEY`               |

## Configuration

```typescript
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

const sandbox = new ComputeSDKSandbox({
  // Required: Cloud provider to use
  provider: 'e2b',

  // ComputeSDK API key (or set COMPUTESDK_API_KEY env var)
  apiKey: 'computesdk_xxx',

  // Provider-specific API key (or use env vars)
  providerApiKey: 'e2b_xxx',

  // Optional settings
  timeout: 60000,           // 60 second timeout
  templateId: 'my-template', // Provider-specific template
  env: {                    // Environment variables in sandbox
    NODE_ENV: 'production',
    API_KEY: 'secret',
  },
  metadata: {               // Additional metadata
    project: 'my-project',
  },
});
```

## Using with Agents

```typescript
import { Agent, Workspace } from '@mastra/core';
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

// Agent automatically gets workspace tools
const agent = new Agent({
  name: 'code-runner',
  model: 'gpt-4',
  workspace: new Workspace({
    sandbox: new ComputeSDKSandbox({
      provider: 'e2b',
    }),
  }),
});

// Agent can now use workspace_execute_code tool
const response = await agent.generate(
  'Run this Python code: print(sum(range(100)))'
);
```

## Supported Runtimes

- `node` - Node.js / JavaScript
- `python` - Python 3
- `bash` / `shell` - Shell scripts

## API Reference

### ComputeSDKSandbox

#### Constructor Options

| Option          | Type                  | Default     | Description                          |
|-----------------|-----------------------|-------------|--------------------------------------|
| `provider`      | `ComputeProvider`     | required    | Cloud provider (e2b, modal, etc.)    |
| `apiKey`        | `string`              | env var     | ComputeSDK API key                   |
| `providerApiKey`| `string`              | env var     | Provider-specific API key            |
| `id`            | `string`              | auto        | Unique sandbox identifier            |
| `name`          | `string`              | auto        | Human-readable name                  |
| `timeout`       | `number`              | `30000`     | Default operation timeout (ms)       |
| `templateId`    | `string`              | undefined   | Provider-specific template           |
| `env`           | `Record<string,string>`| undefined  | Environment variables                |
| `metadata`      | `Record<string,any>`  | undefined   | Additional metadata                  |

#### Methods

```typescript
// Lifecycle
await sandbox.start();           // Create cloud sandbox
await sandbox.stop();            // Stop (mark as stopped)
await sandbox.destroy();         // Destroy and cleanup
await sandbox.isReady();         // Check if ready
await sandbox.getInfo();         // Get sandbox metadata

// Code execution
await sandbox.executeCode(code, { runtime: 'python' });
await sandbox.executeCommand('npm', ['install', 'lodash']);
await sandbox.installPackage('lodash', { packageManager: 'npm' });
```

## Environment Variables

```bash
# ComputeSDK API key (required)
COMPUTESDK_API_KEY=computesdk_xxx

# Provider-specific (set based on your provider)
E2B_API_KEY=e2b_xxx
MODAL_TOKEN_ID=xxx
MODAL_TOKEN_SECRET=xxx
RAILWAY_API_KEY=xxx
# ... etc
```

## Security

ComputeSDK sandboxes run in isolated cloud environments:

- **Full isolation**: Code runs in separate VMs/containers
- **Network isolation**: Each sandbox has its own network
- **Time-limited**: Sandboxes auto-terminate after timeout
- **No local access**: Cannot access your local filesystem

This makes it safe to execute untrusted code from AI agents.

## License

Apache-2.0
