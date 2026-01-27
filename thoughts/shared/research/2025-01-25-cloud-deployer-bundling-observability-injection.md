---
date: 2026-01-25T18:37:05Z
researcher: Claude
git_commit: 0cb445d5776d24dc806496896fc034fe4a673698
branch: mastra-admin-example
repository: mastra-ai/mastra
topic: "Cloud Deployer Bundling and Observability Code Injection Patterns"
tags: [research, deployer, bundling, observability, code-injection, babel, rollup]
status: complete
last_updated: 2026-01-25
last_updated_by: Claude
---

# Research: Cloud Deployer Bundling and Observability Code Injection Patterns

**Date**: 2026-01-25T18:37:05Z
**Researcher**: Claude
**Git Commit**: 0cb445d5776d24dc806496896fc034fe4a673698
**Branch**: mastra-admin-example
**Repository**: mastra-ai/mastra

## Research Question

Research the cloud deployer for how the admin runner can bundle projects and inject observability code.

## Summary

The cloud deployers use a sophisticated bundling pipeline with Rollup and Babel transformations that generate platform-specific server entry code. The key pattern is **entry point code generation** - deployers generate custom `index.mjs` server entry files that wrap the user's Mastra instance with platform-specific code (logging, auth, storage).

The CloudDeployer specifically demonstrates injection patterns for:
1. **Logger injection**: Wrapping existing logger with HTTP transport
2. **Storage injection**: Conditionally injecting LibSQL storage based on environment
3. **Auth injection**: Wrapping auth with cloud-specific auth providers

The admin runner currently executes user's native build scripts (`npm run build`) and expects output in `.mastra/output/`. To inject observability, the admin runner would need to either:
1. **Pre-build injection**: Modify source files before build (like Babel plugins)
2. **Post-build injection**: Wrap the bundled entry point with observability code
3. **Runtime injection**: Pass observability config via environment variables

## Detailed Findings

### Cloud Deployer Architecture

#### Base Classes (`packages/deployer/`)

**`Bundler` abstract class** (`packages/deployer/src/bundler/index.ts:28`):
- Core bundling logic shared by all deployers
- Uses Rollup for JavaScript bundling
- Manages virtual module aliases: `#server`, `#mastra`, `#tools`
- Executes Babel transformations for code modification

**`Deployer` abstract class** (`packages/deployer/src/deploy/base.ts:7`):
- Extends `Bundler`
- Adds environment file handling (`.env.production`, `.env.local`, `.env`)
- Abstract `deploy()` method for platform-specific deployment

#### CloudDeployer Implementation (`deployers/cloud/src/index.ts`)

The CloudDeployer demonstrates the key injection patterns:

**Entry Point Generation** (`getEntry()` lines 98-203):

```typescript
getEntry(options: EntryOptions): string {
  // Generates server entry as CODE STRING, not file
  return `
    import { mastra } from '#mastra';
    import { createNodeServer } from '#server';
    import { tools } from '#tools';

    // INJECTION 1: Logger wrapping
    ${this.getLoggerInjection()}

    // INJECTION 2: Storage injection
    ${this.getStorageInjection()}

    // INJECTION 3: Auth injection
    ${getAuthEntrypoint()}

    // Create server with injected components
    createNodeServer({ ...options, mastra, tools });
  `;
}
```

**Logger Injection** (lines 103-144):
- Imports `MultiLogger` from `@mastra/loggers`
- Creates HTTP transport logger sending to telemetry endpoint
- Wraps existing `mastra.getLogger()` with MultiLogger
- Injects via `mastra.__setLogger(combinedLogger)`

**Storage Injection** (lines 146-164):
- Checks for `MASTRA_STORAGE_URL` environment variable
- Conditionally creates `LibSQLStore` if URL present
- Injects via `mastra.__setStorage(newStorage)`

**Auth Injection** (`deployers/cloud/src/utils/auth.ts:1-43`):
- Generates `MastraCloudAuth` class extending `SimpleAuth`
- Creates `CompositeAuth` wrapping existing auth
- Injects via `mastra.__setServerAuth(compositeAuth)`

### Babel Code Transformation Patterns

The deployer uses Babel plugins to transform user's Mastra configuration during bundling:

#### Remove Deployer Plugin (`packages/deployer/src/build/babel/remove-deployer.ts`)

Removes the `deployer` property from Mastra config:
```typescript
// Before:
export const mastra = new Mastra({
  agents: { ... },
  deployer: new CloudDeployer(),  // REMOVED
});

// After:
export const mastra = new Mastra({
  agents: { ... },
});
```

#### Cloudflare Mastra Instance Wrapper (`deployers/cloudflare/src/babel/mastra-instance-wrapper.ts`)

Wraps Mastra instantiation in a function for request isolation:
```typescript
// Before:
export const mastra = new Mastra({ ... });

// After:
export const mastra = () => new Mastra({ ... });
```

#### Extract Config Option (`packages/deployer/src/build/babel/remove-all-options-except.ts`)

Extracts specific config options for analysis:
```typescript
// Source:
export const mastra = new Mastra({
  bundler: { externals: true },
  agents: { ... },
});

// Extracted bundler config:
export const __mastra_bundler = { externals: true };
```

### Virtual Module System

The bundler uses virtual module aliases resolved during bundling:

| Alias | Resolves To | Purpose |
|-------|-------------|---------|
| `#server` | `@mastra/deployer/server` | Server framework (Hono) |
| `#mastra` | User's `src/mastra/index.ts` | User's Mastra instance |
| `#tools` | Generated `tools.mjs` | Bundled tools array |
| `#entry` | Generated entry code (string) | Server entry point |
| `#polyfills` | Cloudflare-specific shims | Node.js compatibility |

Configuration at `packages/deployer/src/build/bundler.ts:88-119`:
```typescript
alias({
  entries: [
    { find: '#server', replacement: '@mastra/deployer/server' },
    { find: '#mastra', replacement: entryFile },
    // ...
  ]
})
```

### Admin Runner Build Process

#### Current Flow (`runners/local/src/build/builder.ts`)

The admin runner uses a different approach - it executes the user's native build:

1. **Source Acquisition** (`runner.ts:209-211`): Copy project to `{tmpdir}/mastra/builds/{buildId}`
2. **Dependency Installation** (`builder.ts:65-69`): Run `npm/pnpm/yarn install`
3. **Build Execution** (`builder.ts:72-78`): Run `npm run build` (user's build script)
4. **Output Verification** (`builder.ts:81-84`): Check `.mastra/output/index.mjs` exists

The user's build script is expected to use `mastra build` CLI command which produces bundled output via the deployer system.

#### Key Difference

| Aspect | Cloud Deployer | Admin Runner |
|--------|---------------|--------------|
| Entry Generation | Generates custom entry code | Uses user's built output |
| Injection Point | During bundling (Babel/Rollup) | Not currently implemented |
| Output Control | Full control over entry.mjs | Depends on user's build |

### Observability Configuration Patterns

#### Standard Mastra Configuration (`packages/core/src/mastra/index.ts`)

Users configure observability in the Mastra constructor:

```typescript
import { Observability, DefaultExporter, CloudExporter } from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [
          new DefaultExporter(),  // Stores to MastraStorage
          new CloudExporter(),    // Sends to Mastra Cloud
        ],
      },
    },
  }),
});
```

#### Observability Injection at Runtime (`packages/core/src/mastra/index.ts:489-505`)

The Mastra class validates and stores observability at construction:
```typescript
if (config.observability && typeof config.observability.getDefaultInstance === 'function') {
  this.#observability = config.observability;
  this.#observability.setLogger(this.#logger);
} else {
  this.#observability = new NoOpObservability();
}
```

After initialization, Mastra calls `setMastraContext()` on observability (line 615):
```typescript
this.#observability.setMastraContext({ mastra: this });
```

This allows exporters to access Mastra's storage for span persistence.

### Cloud Deployer Injection Techniques

#### Technique 1: Entry Code String Generation

The CloudDeployer generates entry code as a string that imports and wraps user code:

```typescript
// deployers/cloud/src/index.ts:98-203
getEntry(options: EntryOptions): string {
  const authEntryPoint = getAuthEntrypoint();

  return `
import { mastra as mastraInstance } from '#mastra';
import { createNodeServer } from '#server';
import { tools } from '#tools';
import { MultiLogger, PinoHttpLogger } from '@mastra/loggers';

// Create new logger combining existing with HTTP transport
const existingLogger = mastraInstance.getLogger();
const httpLogger = new PinoHttpLogger({ /* config */ });
const combinedLogger = new MultiLogger({ loggers: [existingLogger, httpLogger] });
mastraInstance.__setLogger(combinedLogger);

// Inject storage if env var present
${process.env.MASTRA_STORAGE_URL ? `
import { LibSQLStore } from '@mastra/libsql';
const newStorage = new LibSQLStore({ url: process.env.MASTRA_STORAGE_URL });
mastraInstance.__setStorage(newStorage);
` : ''}

// Inject cloud auth
${authEntryPoint}

createNodeServer({ ...options, mastra: mastraInstance, tools });
`;
}
```

#### Technique 2: Babel AST Transformation

Babel plugins modify the source code AST:

```typescript
// packages/deployer/src/build/babel/remove-deployer.ts
export default function removeDeployer(): PluginObj {
  return {
    visitor: {
      ObjectProperty(path) {
        if (path.node.key.name === 'deployer') {
          path.remove();
        }
      }
    }
  };
}
```

#### Technique 3: Rollup Plugin Wrapping

Rollup plugins intercept and transform code during bundling:

```typescript
// deployers/cloudflare/src/plugins/mastra-instance-wrapper.ts
export function mastraInstanceWrapper(): Plugin {
  return {
    name: 'mastra-instance-wrapper',
    transform(code, id) {
      if (!id.includes('mastra/index')) return null;

      // Apply Babel transformation
      const result = transformSync(code, {
        plugins: [mastraInstanceWrapperBabel()],
      });

      return { code: result.code, map: result.map };
    }
  };
}
```

### Admin Example Observability Setup

The admin example (`examples/admin/src/server.ts`) shows current observability configuration:

**File Storage Setup** (lines 122-125):
```typescript
const observabilityStorage = new LocalFileStorage({
  basePath: 'data/observability',
});
```

**ClickHouse Query Provider** (lines 128-145):
```typescript
const queryProvider = new ClickHouseQueryProvider({
  url: process.env.CLICKHOUSE_URL,
  database: 'mastra_admin',
});
await queryProvider.init();
```

**MastraAdmin Configuration** (lines 186-192):
```typescript
const admin = new MastraAdmin({
  observability: {
    fileStorage: observabilityStorage,
    queryProvider,
  },
});
```

**Injection into Runner** (`packages/admin/src/mastra-admin.ts:301-303`):
```typescript
if (this.#observabilityConfig?.fileStorage && this.#runner) {
  this.#runner.setObservabilityStorage(this.#observabilityConfig.fileStorage);
}
```

## Code References

### Entry Point Generation
- `deployers/cloud/src/index.ts:98-203` - CloudDeployer `getEntry()` method
- `deployers/vercel/src/index.ts:25-47` - VercelDeployer entry generation
- `deployers/netlify/src/index.ts:73-89` - NetlifyDeployer entry generation
- `deployers/cloudflare/src/index.ts:87-108` - CloudflareDeployer entry generation

### Babel Transformations
- `packages/deployer/src/build/babel/remove-deployer.ts:3-83` - Remove deployer property
- `packages/deployer/src/build/babel/remove-all-options-except.ts:6-104` - Extract config options
- `deployers/cloudflare/src/babel/mastra-instance-wrapper.ts:25-50` - Wrap Mastra in function

### Rollup Plugins
- `packages/deployer/src/build/plugins/remove-deployer.ts:6-38` - Rollup wrapper for Babel
- `deployers/cloudflare/src/plugins/mastra-instance-wrapper.ts:5-30` - Instance wrapper plugin

### Admin Runner Build
- `runners/local/src/build/builder.ts:34-104` - ProjectBuilder.build() method
- `runners/local/src/runner.ts:206-225` - LocalProcessRunner.build() method

### Observability Configuration
- `packages/core/src/mastra/index.ts:489-505` - Mastra observability initialization
- `observability/mastra/src/default.ts:31-144` - Observability class implementation
- `packages/admin/src/mastra-admin.ts:301-303` - Admin runner observability injection

## Architecture Documentation

### Deployer Bundling Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD DEPLOYER PIPELINE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ANALYSIS PHASE                                                           │
│  ┌───────────────┐      ┌────────────────┐      ┌──────────────────┐       │
│  │ User's        │ ───► │ Babel: Extract │ ───► │ Dependency       │       │
│  │ src/mastra/   │      │ bundler config │      │ Analysis         │       │
│  └───────────────┘      └────────────────┘      └──────────────────┘       │
│                                                                              │
│  2. TRANSFORMATION PHASE                                                     │
│  ┌───────────────┐      ┌────────────────┐      ┌──────────────────┐       │
│  │ Rollup        │ ───► │ Babel Plugins: │ ───► │ Virtual Module   │       │
│  │ Bundle        │      │ - remove-dep   │      │ Resolution       │       │
│  │               │      │ - wrap-mastra  │      │ #server, #mastra │       │
│  └───────────────┘      └────────────────┘      └──────────────────┘       │
│                                                                              │
│  3. ENTRY GENERATION PHASE                                                   │
│  ┌───────────────┐      ┌────────────────┐      ┌──────────────────┐       │
│  │ getEntry()    │ ───► │ Code String    │ ───► │ Injections:      │       │
│  │ method        │      │ Generation     │      │ - Logger         │       │
│  │               │      │                │      │ - Storage        │       │
│  │               │      │                │      │ - Auth           │       │
│  └───────────────┘      └────────────────┘      └──────────────────┘       │
│                                                                              │
│  4. OUTPUT PHASE                                                             │
│  ┌───────────────┐      ┌────────────────┐      ┌──────────────────┐       │
│  │ Write         │ ───► │ Install        │ ───► │ Platform         │       │
│  │ package.json  │      │ dependencies   │      │ config files     │       │
│  │               │      │                │      │ (wrangler.json)  │       │
│  └───────────────┘      └────────────────┘      └──────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Admin Runner vs Cloud Deployer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN RUNNER CURRENT FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SOURCE COPY         2. INSTALL           3. BUILD                       │
│  ┌─────────────┐       ┌───────────┐        ┌─────────────┐                │
│  │ Copy to     │ ───► │ npm/pnpm  │  ───► │ npm run     │                 │
│  │ build dir   │       │ install   │        │ build       │                │
│  └─────────────┘       └───────────┘        └─────────────┘                │
│                                                    │                        │
│                                                    ▼                        │
│  4. VERIFY              5. DEPLOY                                           │
│  ┌─────────────┐       ┌───────────────────────────────┐                   │
│  │ Check       │ ◄─── │ .mastra/output/index.mjs      │                   │
│  │ output      │       │ (User's bundled code)         │                   │
│  │ exists      │       │                               │                   │
│  └─────────────┘       │  ❌ NO INJECTION POINT ❌     │                   │
│                        └───────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD DEPLOYER FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ANALYZE             2. TRANSFORM          3. GENERATE ENTRY             │
│  ┌─────────────┐       ┌───────────┐        ┌─────────────────────┐        │
│  │ Read user   │ ───► │ Babel     │  ───► │ getEntry() with     │        │
│  │ source      │       │ transform │        │ INJECTIONS          │        │
│  └─────────────┘       └───────────┘        └─────────────────────┘        │
│                                                    │                        │
│                                                    ▼                        │
│  4. BUNDLE              5. OUTPUT                                           │
│  ┌─────────────┐       ┌───────────────────────────────┐                   │
│  │ Rollup      │ ───► │ output/index.mjs              │                   │
│  │ bundle      │       │ (Deployer-controlled entry)   │                   │
│  │ with        │       │                               │                   │
│  │ virtual     │       │  ✓ Logger injection          │                   │
│  │ modules     │       │  ✓ Storage injection         │                   │
│  │             │       │  ✓ Auth injection            │                   │
│  └─────────────┘       └───────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Injection Patterns Available

| Pattern | How It Works | Admin Runner Applicability |
|---------|--------------|----------------------------|
| Entry Code Generation | Generate entry.mjs as string with injections | Requires custom bundler, not native build |
| Babel AST Transform | Modify source code during bundling | Requires hooking into build process |
| Rollup Plugin | Intercept and transform during bundle | Requires using Rollup, not native build |
| Runtime Env Vars | Pass config via environment variables | Works with current native build approach |
| Wrapper Script | Generate wrapper that imports user code | Post-build, can wrap existing output |

## Related Research

- `thoughts/shared/research/2025-01-25-observability-data-flow-gaps.md` - Observability data flow analysis
- `thoughts/shared/research/2025-01-25-observability-injection-patterns.md` - Injection pattern research
- `thoughts/shared/plans/2025-01-25-observability-architecture-refinement.md` - Architecture refinement plan

## Open Questions

1. **Should admin runner use deployer's bundler instead of native build?**
   - Would provide full control over entry generation
   - Requires understanding user's project structure
   - May conflict with custom build configurations

2. **Can observability be injected via environment variables?**
   - `MASTRA_OBSERVABILITY_ENDPOINT` for cloud exporter
   - `MASTRA_STORAGE_URL` already used for LibSQL
   - Requires user's code to read these env vars

3. **Post-build wrapper approach?**
   - Generate `wrapper.mjs` that imports `index.mjs`
   - Injects observability before calling user's code
   - Start process with `node wrapper.mjs` instead of `node index.mjs`

4. **How does user's Mastra instance need to be configured for admin observability?**
   - Currently, user configures observability in their `src/mastra/index.ts`
   - Admin needs to inject its own exporters (cloud exporter to admin backend)
   - May need `__setObservability()` or similar runtime injection method
