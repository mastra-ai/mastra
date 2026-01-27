---
date: 2026-01-25T18:47:50Z
researcher: Claude
git_commit: 0cb445d5776d24dc806496896fc034fe4a673698
branch: mastra-admin-example
repository: mastra-ai/mastra
topic: "AdminDeployer Implementation Pattern for Observability Injection"
tags: [research, deployer, bundler, observability, injection, admin-runner]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: AdminDeployer Implementation Pattern for Observability Injection

**Date**: 2026-01-25T18:47:50Z
**Researcher**: Claude
**Git Commit**: 0cb445d5776d24dc806496896fc034fe4a673698
**Branch**: mastra-admin-example
**Repository**: mastra-ai/mastra

## Research Question

What would an AdminDeployer implementation look like based on existing deployer patterns, specifically for injecting observability code during the bundling process?

## Summary

Based on the existing deployer architecture, an `AdminBundler` class can be implemented that:

1. **Extends `Bundler`** from `@mastra/deployer/bundler` (not `Deployer`, since admin doesn't need cloud deployment)
2. **Generates custom entry code** via `getEntry()` method that injects:
   - Observability configuration with CloudExporter pointing to admin backend
   - Logger wrapping for log streaming to admin
   - Admin-specific environment variable handling
3. **Replaces `npm run build`** in the admin runner with direct `bundle()` call
4. **Outputs to `.mastra/output/`** with the same structure as CLI builds

The key insight is that entry point code generation happens as a **string** that gets bundled via Rollup's virtual module system. This allows injecting arbitrary initialization code that runs before the user's Mastra instance starts.

## Detailed Findings

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ADMIN BUNDLER ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  AdminBundler   │ extends Bundler (packages/deployer/src/bundler/)       │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │  Implements:                                                    │
│           │  - bundle(mastraDir, outputDir, options)                        │
│           │  - getEntry(options) → string                                   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Entry Code Generation                            │   │
│  │                                                                      │   │
│  │  import { mastra } from '#mastra';           // User's instance      │   │
│  │  import { createNodeServer } from '#server'; // Server framework     │   │
│  │  import { tools } from '#tools';             // Bundled tools        │   │
│  │                                                                      │   │
│  │  // INJECTION 1: Observability                                       │   │
│  │  import { Observability, CloudExporter } from '@mastra/observability';│  │
│  │  const adminExporter = new CloudExporter({                           │   │
│  │    endpoint: process.env.MASTRA_ADMIN_OBSERVABILITY_ENDPOINT,        │   │
│  │    accessToken: process.env.MASTRA_ADMIN_OBSERVABILITY_TOKEN,        │   │
│  │  });                                                                 │   │
│  │  mastra.observability.registerInstance('admin', new Observability({  │   │
│  │    exporters: [adminExporter, ...existingExporters],                 │   │
│  │  }));                                                                │   │
│  │                                                                      │   │
│  │  // INJECTION 2: Logger wrapping                                     │   │
│  │  const combinedLogger = new MultiLogger([adminLogger, existingLogger]);│  │
│  │  mastra.setLogger({ logger: combinedLogger });                       │   │
│  │                                                                      │   │
│  │  // Start server                                                     │   │
│  │  await createNodeServer(mastra, { tools });                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Rollup Bundling                                 │   │
│  │                                                                      │   │
│  │  Virtual Modules:                                                    │   │
│  │  - #entry  → Generated entry code string                             │   │
│  │  - #mastra → User's src/mastra/index.ts                              │   │
│  │  - #server → @mastra/deployer/server                                 │   │
│  │  - #tools  → Generated tools.mjs                                     │   │
│  │                                                                      │   │
│  │  Output:                                                             │   │
│  │  - .mastra/output/index.mjs     (entry with injections)              │   │
│  │  - .mastra/output/mastra.mjs    (user's Mastra code)                 │   │
│  │  - .mastra/output/tools.mjs     (bundled tools)                      │   │
│  │  - .mastra/output/package.json  (dependencies)                       │   │
│  │  - .mastra/output/node_modules/ (installed deps)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Base Class: Bundler

**Location**: `packages/deployer/src/bundler/index.ts`

The `Bundler` class provides the core bundling infrastructure:

```typescript
export abstract class Bundler extends MastraBundler {
  protected analyzeOutputDir = '.build';  // Temp analysis directory
  protected outputDir = 'output';         // Final bundle location
  protected platform: BundlerPlatform = 'node';

  // Key methods:
  async prepare(outputDirectory: string): Promise<void>
  async writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>
  protected async _bundle(serverFile: string, mastraEntryFile: string, options, toolsPaths): Promise<void>
  protected async installDependencies(outputDirectory: string): Promise<void>
  getAllToolPaths(mastraDir: string): (string | string[])[]
}
```

**Key Method: `_bundle()`** (`bundler/index.ts:269-454`):

This is the core bundling method that:
1. Extracts user's bundler options from Mastra config
2. Analyzes dependencies with Rollup
3. Generates `package.json` with external dependencies
4. Creates Rollup bundle with virtual modules
5. Writes `tools.mjs` with tool exports
6. Copies public files and `.npmrc`
7. Installs dependencies

### CloudDeployer Reference Implementation

**Location**: `deployers/cloud/src/index.ts`

The CloudDeployer demonstrates the complete pattern:

```typescript
export class CloudDeployer extends Deployer {
  constructor({ studio }: { studio?: boolean } = {}) {
    super({ name: 'cloud' });
    this.studio = studio ?? false;
  }

  async bundle(mastraDir: string, outputDirectory: string): Promise<void> {
    const mastraEntryFile = getMastraEntryFile(mastraDir);
    const mastraAppDir = join(mastraDir, 'mastra');
    const discoveredTools = this.getAllToolPaths(mastraAppDir);

    await this.prepare(outputDirectory);
    await this._bundle(
      this.getEntry(),        // <-- Custom entry code as STRING
      mastraEntryFile,
      { outputDirectory, projectRoot: mastraDir },
      discoveredTools,
    );
  }

  private getEntry(): string {
    return `
      import { mastra } from '#mastra';
      import { createNodeServer } from '#server';
      import { tools } from '#tools';

      // Logger injection...
      // Storage injection...
      // Auth injection...

      await createNodeServer(mastra, { tools });
    `;
  }
}
```

### Mastra Runtime Injection Methods

**Location**: `packages/core/src/mastra/index.ts`

The Mastra class provides these setter methods for runtime injection:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `setLogger` | `setLogger({ logger: TLogger })` | Set logger and propagate to all components |
| `setStorage` | `setStorage(storage: MastraCompositeStore)` | Set storage provider |
| `setIdGenerator` | `setIdGenerator(fn: MastraIdGenerator)` | Set ID generator function |
| `setServerMiddleware` | `setServerMiddleware(middleware)` | Set server middleware |
| `observability` (getter) | Returns `ObservabilityEntrypoint` | Access observability for configuration |

**Observability Access** (`mastra/index.ts:2596-2598`):

```typescript
get observability(): ObservabilityEntrypoint {
  return this.#observability;
}
```

The `ObservabilityEntrypoint` interface provides:
- `registerInstance(name, instance, isDefault?)` - Register new observability instance
- `getInstance(name)` - Get registered instance
- `setLogger({ logger })` - Set logger on observability
- `setMastraContext({ mastra })` - Inject Mastra reference

### CloudExporter for External Transmission

**Location**: `observability/mastra/src/exporters/cloud.ts`

The CloudExporter sends spans to an external endpoint:

```typescript
interface CloudExporterConfig {
  maxBatchSize?: number;   // Default: 1000
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number;     // Default: 3
  accessToken?: string;    // From config or MASTRA_CLOUD_ACCESS_TOKEN
  endpoint?: string;       // Default: https://api.mastra.ai/ai/spans/publish
}
```

**Key Features**:
- Batches spans before transmission
- Exponential backoff retry (2s, 4s, 8s, max 10s)
- JSON payload: `{ spans: MastraCloudSpanRecord[] }`
- Bearer token authentication

### AdminBundler Implementation Pattern

Based on the above research, here's what an `AdminBundler` would look like:

```typescript
// packages/admin/src/bundler/admin-bundler.ts

import { join, dirname } from 'node:path';
import { Bundler } from '@mastra/deployer/bundler';
import type { AdminBundlerConfig } from './types';

export class AdminBundler extends Bundler {
  private config: AdminBundlerConfig;

  constructor(config: AdminBundlerConfig) {
    super('admin-bundler', 'BUNDLER');
    this.config = config;
  }

  /**
   * Bundle a Mastra project with admin observability injection
   */
  async bundle(
    mastraDir: string,
    outputDirectory: string,
    options: {
      projectId: string;
      deploymentId: string;
      serverId: string;
      observabilityEndpoint: string;
      observabilityToken: string;
      logStreamEndpoint?: string;
    }
  ): Promise<void> {
    const mastraEntryFile = this.getMastraEntryFile(mastraDir);
    const mastraAppDir = join(mastraDir, 'mastra');
    const discoveredTools = this.getAllToolPaths(mastraAppDir);

    await this.prepare(outputDirectory);
    await this._bundle(
      this.getEntry(options),
      mastraEntryFile,
      {
        outputDirectory,
        projectRoot: mastraDir,
        enableEsmShim: true,
      },
      discoveredTools,
    );
  }

  /**
   * Find the Mastra entry file in a project
   */
  private getMastraEntryFile(mastraDir: string): string {
    const possiblePaths = [
      join(mastraDir, 'mastra', 'index.ts'),
      join(mastraDir, 'mastra', 'index.js'),
      join(mastraDir, 'src', 'mastra', 'index.ts'),
      join(mastraDir, 'src', 'mastra', 'index.js'),
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) return path;
    }

    throw new Error(`No Mastra entry file found in ${mastraDir}`);
  }

  /**
   * Generate entry code with admin observability injection
   */
  private getEntry(options: {
    projectId: string;
    deploymentId: string;
    serverId: string;
    observabilityEndpoint: string;
    observabilityToken: string;
    logStreamEndpoint?: string;
  }): string {
    return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';

// ============================================================
// ADMIN OBSERVABILITY INJECTION
// ============================================================

// Import observability dependencies
import { CloudExporter } from '@mastra/observability';
import { MultiLogger } from '@mastra/core/logger';
import { PinoLogger } from '@mastra/loggers';
${options.logStreamEndpoint ? `import { HttpTransport } from '@mastra/loggers/http';` : ''}

// Configuration from admin
const ADMIN_CONFIG = {
  projectId: '${options.projectId}',
  deploymentId: '${options.deploymentId}',
  serverId: '${options.serverId}',
  observabilityEndpoint: '${options.observabilityEndpoint}',
  observabilityToken: '${options.observabilityToken}',
  logStreamEndpoint: ${options.logStreamEndpoint ? `'${options.logStreamEndpoint}'` : 'null'},
};

console.log('[Admin] Initializing with config:', {
  projectId: ADMIN_CONFIG.projectId,
  deploymentId: ADMIN_CONFIG.deploymentId,
  serverId: ADMIN_CONFIG.serverId,
});

// ============================================================
// 1. OBSERVABILITY INJECTION
// ============================================================

// Create admin CloudExporter pointing to admin backend
const adminExporter = new CloudExporter({
  endpoint: ADMIN_CONFIG.observabilityEndpoint,
  accessToken: ADMIN_CONFIG.observabilityToken,
  maxBatchSize: 100,      // Smaller batches for faster feedback
  maxBatchWaitMs: 2000,   // Faster flushes for real-time
});

// Get existing observability instance and its exporters
const existingInstance = mastra.observability.getDefaultInstance();
const existingExporters = existingInstance?.getExporters?.() || [];

// Register admin exporter alongside existing ones
if (existingInstance) {
  // If user has observability, add our exporter to their config
  existingInstance.addExporter?.(adminExporter);
} else {
  // If no observability, register a new instance with our exporter
  const { Observability, DefaultExporter } = await import('@mastra/observability');
  const adminObservability = new Observability({
    configs: {
      admin: {
        serviceName: 'mastra-admin-${options.projectId}',
        exporters: [
          new DefaultExporter(),  // Store locally if storage exists
          adminExporter,          // Stream to admin
        ],
      },
    },
  });
  adminObservability.setMastraContext({ mastra });
  mastra.observability.registerInstance('admin', adminObservability.getDefaultInstance(), true);
}

console.log('[Admin] Observability configured with endpoint:', ADMIN_CONFIG.observabilityEndpoint);

// ============================================================
// 2. LOGGER INJECTION
// ============================================================

${options.logStreamEndpoint ? `
// Create HTTP transport for log streaming to admin
const adminLogTransport = new HttpTransport({
  url: ADMIN_CONFIG.logStreamEndpoint,
  headers: {
    'Authorization': 'Bearer ' + ADMIN_CONFIG.observabilityToken,
    'X-Mastra-Project-Id': ADMIN_CONFIG.projectId,
    'X-Mastra-Deployment-Id': ADMIN_CONFIG.deploymentId,
    'X-Mastra-Server-Id': ADMIN_CONFIG.serverId,
  },
});

const adminLogger = new PinoLogger({
  name: 'MastraAdmin',
  level: 'debug',
  transports: {
    admin: adminLogTransport,
  },
});

// Combine with existing logger
const existingLogger = mastra.getLogger();
const combinedLogger = existingLogger
  ? new MultiLogger([adminLogger, existingLogger])
  : adminLogger;

mastra.setLogger({ logger: combinedLogger });
console.log('[Admin] Logger configured with stream endpoint:', ADMIN_CONFIG.logStreamEndpoint);
` : `
// No log stream endpoint configured, keeping existing logger
console.log('[Admin] Log streaming not configured');
`}

// ============================================================
// 3. STORAGE INITIALIZATION
// ============================================================

// Initialize storage if exists
if (mastra.storage) {
  await mastra.storage.init();
  console.log('[Admin] Storage initialized');
}

// ============================================================
// 4. START SERVER
// ============================================================

console.log('[Admin] Starting server...');
await createNodeServer(mastra, {
  studio: false,
  swaggerUI: false,
  tools: getToolExports(tools),
});

console.log('[Admin] Server started successfully');
`;
  }
}
```

### Integration with Admin Runner

The admin runner would use `AdminBundler` instead of `npm run build`:

```typescript
// runners/local/src/runner.ts - Modified build flow

async build(
  project: Project,
  build: Build,
  options?: BuildOptions
): Promise<Build> {
  const projectPath = await this.getProjectPath(project, build.id);
  const outputDir = join(projectPath, '.mastra');

  // Create bundler instance
  const bundler = new AdminBundler({});
  bundler.__setLogger(this.logger);

  // Bundle with observability injection
  await bundler.bundle(projectPath, outputDir, {
    projectId: project.id,
    deploymentId: build.deploymentId,
    serverId: build.id,
    observabilityEndpoint: this.config.observabilityEndpoint,
    observabilityToken: this.config.observabilityToken,
    logStreamEndpoint: this.config.logStreamEndpoint,
  });

  // Verify output
  const outputPath = join(outputDir, 'output', 'index.mjs');
  if (!existsSync(outputPath)) {
    throw new Error('Bundle failed: no output produced');
  }

  return { ...build, status: 'SUCCEEDED' };
}
```

### Environment Variable Alternative

For minimal changes, entry code can read from environment variables:

```typescript
private getEntry(): string {
  return `
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
import { mastra } from '#mastra';

// Read admin config from environment (set by runner)
const ADMIN_OBSERVABILITY_ENDPOINT = process.env.MASTRA_ADMIN_OBSERVABILITY_ENDPOINT;
const ADMIN_OBSERVABILITY_TOKEN = process.env.MASTRA_ADMIN_OBSERVABILITY_TOKEN;
const ADMIN_PROJECT_ID = process.env.MASTRA_PROJECT_ID;
const ADMIN_DEPLOYMENT_ID = process.env.MASTRA_DEPLOYMENT_ID;
const ADMIN_SERVER_ID = process.env.MASTRA_SERVER_ID;

if (ADMIN_OBSERVABILITY_ENDPOINT && ADMIN_OBSERVABILITY_TOKEN) {
  const { CloudExporter } = await import('@mastra/observability');

  const adminExporter = new CloudExporter({
    endpoint: ADMIN_OBSERVABILITY_ENDPOINT,
    accessToken: ADMIN_OBSERVABILITY_TOKEN,
  });

  // ... injection logic
}

await createNodeServer(mastra, { tools: getToolExports(tools) });
`;
}
```

## Code References

### Bundler Base Class
- `packages/deployer/src/bundler/index.ts:28-463` - Bundler class
- `packages/deployer/src/bundler/index.ts:269-454` - `_bundle()` method
- `packages/deployer/src/bundler/index.ts:170-207` - `getBundlerOptions()` method

### CloudDeployer Implementation
- `deployers/cloud/src/index.ts:14-204` - CloudDeployer class
- `deployers/cloud/src/index.ts:70-92` - `bundle()` method
- `deployers/cloud/src/index.ts:98-203` - `getEntry()` method

### Mastra Injection Methods
- `packages/core/src/mastra/index.ts:2485-2525` - `setLogger()` method
- `packages/core/src/mastra/index.ts:2481-2483` - `setStorage()` method
- `packages/core/src/mastra/index.ts:2596-2598` - `observability` getter

### CloudExporter
- `observability/mastra/src/exporters/cloud.ts:9-294` - CloudExporter class
- `observability/mastra/src/exporters/cloud.ts:218-234` - HTTP transmission

### Virtual Module System
- `packages/deployer/src/bundler/index.ts:194-204` - Virtual module resolution

## Architecture Documentation

### Key Design Decisions

1. **Extend Bundler, not Deployer**: AdminBundler only needs bundling, not cloud deployment. Deployer adds unnecessary `deploy()` abstract method.

2. **Entry as String**: The entry point is generated as a code string, not a file. This enables dynamic injection without modifying user files.

3. **Virtual Module Aliases**: `#mastra`, `#server`, `#tools` are resolved by Rollup during bundling, allowing separation of concerns.

4. **Parallel Exporters**: Admin's CloudExporter runs alongside user's existing exporters, not replacing them.

5. **Runtime Injection via Setters**: Logger and observability are configured via Mastra's public setter methods, which cascade to all components.

### Data Flow

```
Admin Runner                    AdminBundler                      Output
    │                               │                                │
    │  bundle(projectPath, opts)    │                                │
    ├──────────────────────────────►│                                │
    │                               │  getEntry(opts)                │
    │                               ├───────────────┐                │
    │                               │               │ Generate       │
    │                               │◄──────────────┘ entry code     │
    │                               │                                │
    │                               │  _bundle(entry, mastraFile)    │
    │                               ├───────────────────────────────►│
    │                               │                                │
    │                               │  Rollup bundle with            │
    │                               │  virtual modules               │
    │                               │                                │
    │                               │◄───────────────────────────────┤
    │                               │                                │
    │  Output: .mastra/output/      │                                │
    │◄──────────────────────────────┤                                │
    │                                                                │
    │  node .mastra/output/index.mjs                                 │
    ├───────────────────────────────────────────────────────────────►│
    │                                                                │
    │                               Runs injected entry code:        │
    │                               1. Create CloudExporter          │
    │                               2. Register with observability   │
    │                               3. Wrap logger                   │
    │                               4. Start server                  │
```

## Related Research

- `thoughts/shared/research/2025-01-25-cloud-deployer-bundling-observability-injection.md` - Deployer bundling patterns
- `thoughts/shared/research/2025-01-25-observability-data-flow-gaps.md` - Observability data flow analysis

## Open Questions

1. **Should AdminBundler be in `packages/admin` or `runners/local`?**
   - Logically belongs in admin since it's admin-specific bundling
   - But runner is what uses it, so co-location might make sense

2. **How to handle user's existing observability configuration?**
   - Current pattern adds exporter to existing instance
   - May need `addExporter()` method on ObservabilityInstance

3. **Should admin observability be opt-out via environment variable?**
   - `MASTRA_ADMIN_DISABLE_OBSERVABILITY=true` to skip injection
   - Useful for debugging user's own observability setup

4. **Dependency management for injected imports**
   - `@mastra/observability`, `@mastra/loggers` must be in bundle
   - Bundler already handles this via dependency analysis
   - Need to ensure these are installed in output

5. **Error handling during injection**
   - What if CloudExporter fails to initialize?
   - Should server still start? (Yes, with warning)
   - Need try/catch around injection code
