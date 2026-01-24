# @mastra/runner-local

Local process runner for MastraAdmin. This package enables building Mastra projects and running them as child processes, suitable for local development and self-hosted deployments.

## Installation

```bash
pnpm add @mastra/runner-local
```

## Usage

```typescript
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalProjectSource } from '@mastra/source-local';

// Create and configure the runner
const runner = new LocalProcessRunner({
  portRange: { start: 4111, end: 4200 },
  healthCheck: {
    timeoutMs: 5000,
    retryIntervalMs: 1000,
    maxRetries: 30,
  },
});

// Set the project source provider
const source = new LocalProjectSource({ basePaths: ['/path/to/projects'] });
runner.setSource(source);

// Build a project
const buildResult = await runner.build(project, build, {
  envVars: { API_KEY: 'xxx' },
});

// Deploy and start a server
const server = await runner.deploy(project, deployment, build);

// Check server health
const health = await runner.healthCheck(server);

// Get logs
const logs = await runner.getLogs(server, { tail: 100 });

// Stop the server
await runner.stop(server);

// Shutdown the runner (stops all processes)
await runner.shutdown();
```

## Configuration

```typescript
interface LocalProcessRunnerConfig {
  /** Port range for server allocation. @default { start: 4111, end: 4200 } */
  portRange?: { start: number; end: number };

  /** Maximum concurrent builds. @default 3 */
  maxConcurrentBuilds?: number;

  /** Default build timeout in milliseconds. @default 600000 (10 minutes) */
  defaultBuildTimeoutMs?: number;

  /** Health check configuration */
  healthCheck?: {
    timeoutMs?: number; // @default 5000
    retryIntervalMs?: number; // @default 1000
    maxRetries?: number; // @default 30
    endpoint?: string; // @default '/health'
  };

  /** Number of log lines to retain per server. @default 10000 */
  logRetentionLines?: number;

  /** Working directory for build artifacts. @default '.mastra/builds' */
  buildDir?: string;

  /** Environment variables to inject into all builds */
  globalEnvVars?: Record<string, string>;
}
```

## Features

### Build Process

- Automatic package manager detection (npm, pnpm, yarn, bun)
- Dependency installation with appropriate flags per package manager
- Build script execution with real-time log streaming
- Build output verification

### Process Management

- Child process spawning with stdout/stderr capture
- Process tree termination (kills all child processes)
- Graceful shutdown with SIGTERM/SIGKILL fallback

### Port Allocation

- Automatic port allocation within configured range
- Port conflict detection using `get-port`
- Port tracking and release on process termination

### Health Checks

- HTTP health check with configurable timeout
- Retry mechanism with configurable interval
- Deployment fails if health check times out

### Log Collection

- Circular buffer (ring buffer) for memory-efficient log storage
- Tail and since-based log queries
- Real-time log streaming via callbacks

### Resource Monitoring

- CPU usage monitoring via `pidusage`
- Memory usage monitoring via `pidusage`
- Graceful fallback on monitoring errors

### Subdomain Generation

- Production: `{project-slug}`
- Staging: `staging--{project-slug}`
- Preview: `{branch}--{project-slug}`

## Exported Components

For advanced use cases, individual components can be imported:

```typescript
import {
  // Main runner
  LocalProcessRunner,

  // Components
  PortAllocator,
  HealthChecker,
  ProcessManager,
  ProjectBuilder,
  SubdomainGenerator,
  LogCollectorImpl,
  RingBuffer,

  // Utilities
  detectPackageManager,
  getInstallArgs,
  getBuildArgs,
  hasBuildScript,
  createBuildLogStream,
  createMultiLogStream,
  createFilteredLogStream,
  spawnCommand,
  runCommand,
  getProcessResourceUsage,
  cleanupResourceMonitor,
} from '@mastra/runner-local';
```

## Requirements

- Node.js >= 22.13.0
- `@mastra/admin` >= 1.0.0
- `@mastra/core` >= 0.1.0

## License

Apache-2.0
