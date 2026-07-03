# Implementation Plan: File-Based Primitives

Goal: let users fully define a Mastra project via filesystem convention, eliminating the need for `new Mastra()` in `index.ts`.

---

## Architecture Overview

Today, `mastra dev` / `mastra build` already does this for agents:

```
User's index.ts  ──→  prepareFsAgentsEntry()  ──→  Generated wrapper entry  ──→  Bundler  ──→  Runtime
                        │                             │
                        │ discover.ts: scan agents/*   │ codegen.ts: emit imports + assembleAgentFromFsEntry()
                        │                             │ calls __registerFsAgents() on user's mastra instance
                        ↓                             ↓
                   DiscoveredFsAgent[]            .mastra-fs-agents-entry.mjs
```

The plan extends this to all primitives, and when no `index.ts` exists, the bundler auto-constructs `new Mastra()`.

---

## Phase 1: File-Based Workflows

### Convention

```
src/mastra/workflows/
  recipe-maker.ts     → default-exports createWorkflow({...})
  refund.ts           → default-exports createWorkflow({...})
  *.test.ts           → ignored
```

Each `.ts`/`.js` file (non-test) under `workflows/` that has a default export is auto-registered as `workflows[filename]`.

### Changes Required

#### `packages/deployer/src/build/fs-routing/discover.ts`

Add `discoverFsWorkflows(mastraDir)`:

```ts
export interface DiscoveredFsWorkflow {
  /** Workflow key (filename without extension). */
  key: string;
  /** Absolute, slash-normalized path to the workflow module. */
  path: string;
}

export async function discoverFsWorkflows(mastraDir: string): Promise<DiscoveredFsWorkflow[]> {
  const workflowsDir = join(mastraDir, 'workflows');
  if (!(await exists(workflowsDir))) return [];
  
  const entries = await readdir(workflowsDir);
  const workflows: DiscoveredFsWorkflow[] = [];
  
  for (const basename of entries.sort()) {
    if (isTestFile(basename)) continue;
    if (!TOOL_EXTENSIONS.some(ext => basename.endsWith(ext))) continue;
    const path = join(workflowsDir, basename);
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || stats.isDirectory()) continue;
    
    workflows.push({ key: toolKey(basename), path: slash(path) });
  }
  
  return workflows;
}
```

#### `packages/deployer/src/build/fs-routing/codegen.ts`

Extend `generateFsAgentsModule` (or create a new `generateFsEntryModule`) to also emit workflow imports and registration:

```ts
// For each discovered workflow:
lines.push(`import __wf_${i} from ${JSON.stringify(wf.path)};`);

// After agent registration:
lines.push(`const __fsWorkflows = {`);
for (const wf of workflows) {
  lines.push(`  ${JSON.stringify(wf.key)}: __wf_${i},`);
}
lines.push(`};`);
lines.push(`if (__userEntry.mastra && typeof __userEntry.mastra.__registerFsWorkflows === 'function') {`);
lines.push(`  __userEntry.mastra.__registerFsWorkflows(__fsWorkflows);`);
lines.push(`}`);
```

#### `packages/core/src/mastra/index.ts`

Add `__registerFsWorkflows`, mirroring `__registerFsAgents`:

```ts
public __registerFsWorkflows(fsWorkflows: Record<string, AnyWorkflow>): void {
  if (!fsWorkflows) return;
  for (const [key, workflow] of Object.entries(fsWorkflows)) {
    if (workflow == null) continue;
    const workflows = this.#workflows as Record<string, AnyWorkflow>;
    if (workflows[key]) {
      this.getLogger().warn(
        `File-system routed workflow "${key}" conflicts with a code-registered workflow. Keeping code-registered.`
      );
      continue;
    }
    this.addWorkflow(workflow, key);
  }
}
```

#### `packages/deployer/src/build/fs-routing/prepare.ts`

Extend `prepareFsAgentsEntry` to also call `discoverFsWorkflows` and pass results to codegen.

#### `packages/cli/src/commands/dev/dev.ts` + `build/build.ts`

No structural changes needed — the workflow discovery feeds into the same generated entry module.

### Tests

- `packages/deployer/src/build/fs-routing/fs-routing.test.ts` — add workflow discovery tests
- `packages/core/src/mastra/` — add `fs-and-code-workflows.test.ts` mirroring the agent version

---

## Phase 2: File-Based Global Tools

### Convention

```
src/mastra/tools/
  weather-tool.ts        → default-exports createTool({...})
  billing-tools.ts       → default-exports createTool({...})
  *.test.ts              → ignored
```

### Changes Required

Same pattern as workflows:
- `discoverFsTools(mastraDir)` in `discover.ts` — scans `tools/*.ts`
- Codegen emits imports + `__registerFsTools()`
- `Mastra.__registerFsTools()` in core — calls `addTool()` per entry, code wins on collision

### Note

The CLI already discovers `tools/` paths for bundling (`getAllToolPaths`). This just extends from "bundle them" to "also register them on the Mastra instance". The existing agent-scoped `tools/` discovery inside `agents/<name>/tools/` is separate and unaffected.

---

## Phase 3: File-Based Processors + Scorers

### Convention

```
src/mastra/processors/
  moderation.ts          → default-exports a Processor instance
src/mastra/scorers/
  accuracy.ts            → default-exports a MastraScorer instance
```

### Changes Required

- `discoverFsProcessors(mastraDir)` + `discoverFsScorers(mastraDir)` — same scan pattern
- Codegen + `__registerFsProcessors()` + `__registerFsScorers()` on core
- Tests mirroring the agent coexistence tests

---

## Phase 4: Infrastructure Singleton Files

### Convention

```
src/mastra/
  storage.ts             → default-exports MastraCompositeStore | LibSQLStore | etc.
  observability.ts       → default-exports Observability instance
  server.ts              → default-exports ServerConfig object
  studio.ts              → default-exports StudioConfig object
```

Each is optional. If the file exists, the bundler discovers it at build time and passes the default export as the corresponding `Config` key to `new Mastra()`.

### Changes Required

#### `packages/deployer/src/build/fs-routing/discover.ts`

Add infrastructure discovery:

```ts
export interface DiscoveredFsInfrastructure {
  storagePath?: string;       // storage.ts
  observabilityPath?: string; // observability.ts
  serverPath?: string;        // server.ts
  studioPath?: string;        // studio.ts
}

const INFRA_FILES = {
  storage: ['storage.ts', 'storage.js'],
  observability: ['observability.ts', 'observability.js'],
  server: ['server.ts', 'server.js'],
  studio: ['studio.ts', 'studio.js'],
} as const;

export async function discoverFsInfrastructure(
  mastraDir: string,
): Promise<DiscoveredFsInfrastructure> {
  return {
    storagePath: await firstExisting(mastraDir, [...INFRA_FILES.storage]),
    observabilityPath: await firstExisting(mastraDir, [...INFRA_FILES.observability]),
    serverPath: await firstExisting(mastraDir, [...INFRA_FILES.server]),
    studioPath: await firstExisting(mastraDir, [...INFRA_FILES.studio]),
  };
}
```

#### `packages/deployer/src/build/fs-routing/codegen.ts`

When infrastructure files are discovered, import and pass them to the Mastra constructor in the generated entry:

```ts
if (infra.storagePath) {
  lines.push(`import __storage from ${JSON.stringify(infra.storagePath)};`);
}
if (infra.observabilityPath) {
  lines.push(`import __observability from ${JSON.stringify(infra.observabilityPath)};`);
}
if (infra.serverPath) {
  lines.push(`import __server from ${JSON.stringify(infra.serverPath)};`);
}
if (infra.studioPath) {
  lines.push(`import __studio from ${JSON.stringify(infra.studioPath)};`);
}
```

These are then fed into the Mastra constructor or registered via `__registerFsInfrastructure()`.

#### `packages/core/src/mastra/index.ts`

Add `__registerFsInfrastructure()` or individual setters:

```ts
public __registerFsInfrastructure(infra: {
  storage?: MastraCompositeStore;
  observability?: ObservabilityEntrypoint;
  server?: ServerConfig;
  studio?: StudioConfig;
}): void {
  // Only set if not already configured via constructor
  if (infra.storage && !this.#hasCodeStorage) {
    this.setStorage(infra.storage);
  }
  if (infra.observability && !this.#hasCodeObservability) {
    this.setObservability(infra.observability);
  }
  // server and studio are read-only after construction,
  // so these need the auto-construction path (Phase 5) to work fully
}
```

**Important design decision:** `storage` and `observability` can be post-hoc registered because Mastra has setter methods. But `server` and `studio` are constructor-only config — they need the auto-construction path to work.

### Typing Helpers

Add identity helpers like `agentConfig()`:

```ts
// @mastra/core/storage
export function storageConfig<T extends MastraCompositeStore>(store: T): T { return store; }

// @mastra/core/observability  
export function observabilityConfig<T extends ObservabilityEntrypoint>(o: T): T { return o; }

// @mastra/core/server
export function serverConfig(config: ServerConfig): ServerConfig { return config; }
export function studioConfig(config: StudioConfig): StudioConfig { return config; }
```

These are no-ops but give editor autocomplete for users writing standalone files.

---

## Phase 5: Auto-Construction (No `index.ts`)

### How It Works

When `mastra dev` / `mastra build` cannot find `src/mastra/index.ts` (or `index.js`), instead of erroring, the bundler generates the entire entry module:

```ts
// .mastra-auto-entry.mjs (generated)
import { Mastra } from '@mastra/core';
import { assembleAgentFromFsEntry } from '@mastra/core/agent';

// Infrastructure imports (from Phase 4)
import __storage from '<mastraDir>/storage.ts';
import __observability from '<mastraDir>/observability.ts';
import __server from '<mastraDir>/server.ts';
import __studio from '<mastraDir>/studio.ts';

// Workflow imports (from Phase 1)
import __wf_0 from '<mastraDir>/workflows/recipe-maker.ts';
import __wf_1 from '<mastraDir>/workflows/refund.ts';

// Tool imports (from Phase 2)
import __tool_0 from '<mastraDir>/tools/weather-tool.ts';

// Processor imports (from Phase 3)
import __proc_0 from '<mastraDir>/processors/moderation.ts';

// Agent assembly (existing)
import config_0 from '<mastraDir>/agents/weather/config.ts';
// ... agent assembly code ...

export const mastra = new Mastra({
  storage: __storage,
  observability: __observability,
  server: __server,
  studio: __studio,
  agents: { ...assembledAgents },
  workflows: { "recipe-maker": __wf_0, "refund": __wf_1 },
  tools: { "weather-tool": __tool_0 },
  processors: { "moderation": __proc_0 },
});
```

### Changes Required

#### `packages/cli/src/commands/dev/dev.ts` + `build/build.ts`

Change `getFirstExistingFile` to not throw when `index.ts` is missing:

```ts
const userEntryFile = fileService.getFirstExistingFile(
  [join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')],
  { required: false }  // NEW: don't throw if missing
);

if (!userEntryFile) {
  // Auto-construction mode: generate the full entry from discovered primitives
  const autoEntry = await prepareAutoConstructedEntry(mastraDir, dotMastraPath);
  entryFile = autoEntry.entryFile;
} else {
  // Existing behavior: wrap the user entry with fs-agent discovery
  const fsAgents = await prepareFsAgentsEntry(mastraDir, userEntryFile, dotMastraPath);
  entryFile = fsAgents.entryFile;
}
```

#### `packages/deployer/src/build/fs-routing/prepare.ts`

Add `prepareAutoConstructedEntry()`:

```ts
export async function prepareAutoConstructedEntry(
  mastraDir: string,
  outputDirectory: string,
): Promise<PrepareResult> {
  const agents = await discoverFsAgents(mastraDir);
  const workflows = await discoverFsWorkflows(mastraDir);
  const tools = await discoverFsTools(mastraDir);
  const processors = await discoverFsProcessors(mastraDir);
  const scorers = await discoverFsScorers(mastraDir);
  const infra = await discoverFsInfrastructure(mastraDir);

  const moduleSource = await generateAutoConstructedModule({
    agents, workflows, tools, processors, scorers, infra,
  });

  const generatedEntry = join(outputDirectory, '.mastra-auto-entry.mjs');

  return { entryFile: generatedEntry, moduleSource, ... };
}
```

#### `packages/deployer/src/build/fs-routing/codegen.ts`

Add `generateAutoConstructedModule()` that emits the `new Mastra(...)` call directly.

---

## Phase Summary

| Phase | Packages Touched | Estimated Files Changed | Backward Compat |
|-------|-----------------|------------------------|-----------------|
| 1: Workflows | `deployer`, `core` | ~6 new/modified | 100% — no change if `workflows/` dir absent |
| 2: Tools | `deployer`, `core` | ~4 new/modified | 100% — no change if user imports tools in index.ts |
| 3: Processors + Scorers | `deployer`, `core` | ~6 new/modified | 100% |
| 4: Infra singletons | `deployer`, `core` | ~8 new/modified | 100% — files optional; index.ts config wins |
| 5: Auto-construction | `deployer`, `core`, `cli` | ~10 new/modified | 100% — only when index.ts is absent |

---

## Edge Cases & Design Decisions

### 1. Code wins on collision (all phases)
If a primitive is registered in both code (`new Mastra({ workflows: {...} })`) and via filesystem (`workflows/foo.ts`), the code-registered one is kept with a warning. Same rule as agents.

### 2. Named exports vs default exports (Phase 2: Tools)
For simplicity, MVP requires default exports only:
```ts
// src/mastra/tools/weather-tool.ts
export default createTool({ id: 'get_weather', ... });
```
Named exports (multiple tools per file) can be a follow-up — it complicates discovery since we'd need to evaluate the module to know the export names.

### 3. `server.ts` / `studio.ts` are constructor-only
The Mastra `server` and `studio` config are read during construction and cannot be post-hoc registered. This means:
- **With `index.ts`**: `server.ts` and `studio.ts` can be imported by the user in their own `index.ts`, but the bundler can't inject them retroactively.
- **Without `index.ts`** (Phase 5): works fully since the bundler constructs `new Mastra()` itself.
- **Hybrid**: if user has `index.ts` AND `server.ts`, we could have the generated wrapper override the import. But this may be surprising. Recommendation: in hybrid mode, warn that standalone `server.ts`/`studio.ts` only take effect when no `index.ts` is present.

### 4. `getServerOptions` already bundles + evaluates config
The existing `getServerOptions()` function bundles the user entry, extracts just the `server` config via AST surgery, and evaluates it. When `server.ts` exists as a standalone file, this can be simplified to just importing the file directly — no need to extract it from the Mastra constructor call.

### 5. Workflow glob paths for bundler
Like agent tools, workflow files need to be in the bundler's watch graph. The `toolPaths` array in `PrepareFsAgentsEntryResult` should be generalized to `additionalPaths` or a separate `workflowPaths`.

### 6. MCP servers (deferred)
MCP servers are more complex (they can involve `MCPClient` with stdio transport, proxy wrappers). This is deferred past the MVP but follows the same pattern.

### 7. Gradual migration path
A user can adopt file-based conventions incrementally:
1. Start with `index.ts` exporting everything (today's status quo)
2. Move agents to `agents/<name>/` (already works)
3. Move workflows to `workflows/` (Phase 1)
4. Extract `storage.ts`, `server.ts`, etc. (Phase 4)
5. Delete `index.ts` when everything is file-based (Phase 5)

At every step, the project builds and runs identically.

---

## Testing Strategy

Each phase adds:
1. **Discovery tests** (`fs-routing.test.ts`) — verify the scanner finds the right files and ignores test files, symlinks, etc.
2. **Codegen tests** (`codegen-eval.test.ts`) — verify the generated module source is valid and imports/registers correctly.
3. **Integration tests** (`fs-and-code-*.test.ts`) — verify code-registered and fs-discovered primitives coexist with correct precedence.
4. **CLI tests** (`dev.test.ts`) — verify `mastra dev` and `mastra build` work with the new conventions.
