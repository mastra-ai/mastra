# Proposal: File-Based Primitives to Eliminate `index.ts`

## Current State: File-Based Agents

The file-based agents feature (shipped this week) lets users define agents via filesystem convention under `src/mastra/agents/<name>/`:

```
src/mastra/agents/<name>/
  config.ts          → model + config partial (agentConfig() helper)
  instructions.md    → agent instructions (inlined at build)
  tools/*.ts         → each default-exported createTool(), keyed by filename
  skills/*.ts|*.md   → createSkill() modules or packaged markdown skills
  memory.ts          → default-exported Memory instance
  workspace.ts       → default-exported Workspace instance
  workspace/         → seed files mirrored at build
  subagents/<child>/ → nested agent directories (up to 3 levels)
```

**How it works at build time:**
1. `discoverFsAgents(mastraDir)` scans `agents/*` directories
2. `generateFsAgentsModule()` emits a wrapper that imports all discovered pieces
3. `assembleAgentFromFsEntry()` constructs `Agent` instances from the loaded entries
4. `__registerFsAgents()` merges them onto the user's `Mastra` instance (code wins on collision)

The user's `src/mastra/index.ts` still must:
- `export const mastra = new Mastra({ ... })` with all other primitives manually imported and registered

---

## What Still Requires Manual Registration in `index.ts`

Looking at the `Config` interface, the user currently must manually import and register:

| Primitive | Config key | Typical source |
|-----------|-----------|----------------|
| **Workflows** | `workflows` | `src/mastra/workflows/*.ts` |
| **Tools** (global) | `tools` | `src/mastra/tools/*.ts` |
| **Processors** | `processors` | `src/mastra/processors/*.ts` |
| **MCP Servers** | `mcpServers` | `src/mastra/mcp/*.ts` |
| **Storage** | `storage` | inline or imported |
| **Vectors** | `vectors` | inline or imported |
| **Observability** | `observability` | inline or imported |
| **Gateways** | `gateways` | inline or imported |
| **Memory** (global registry) | `memory` | inline or imported |
| **Server config** | `server` | inline |
| **Channels** | `channels` | inline or imported |
| **AgentControllers** | `agentControllers` | inline or imported |
| **Scorers** | `scorers` | `src/mastra/scorers/*.ts` |

---

## Proposal: Additional File-Based Conventions

### Tier 1: High-Value, Low-Complexity (same pattern as agents)

These follow the exact same "discover → codegen → register" pattern already proven for agents. Each file default-exports its primitive; the filename/directory becomes the key.

#### 1. File-Based Workflows: `src/mastra/workflows/<name>.ts`

```
src/mastra/workflows/
  recipe-maker.ts        → default-exports createWorkflow({...})
  refund.ts              → default-exports createWorkflow({...})
  scheduled/             → future: subdirectory for grouped workflows
```

**Discovery rule:** Each `.ts`/`.js` file under `workflows/` whose default export is a `createWorkflow()` result is registered as `workflows[filename]`. The generated wrapper calls `mastra.__registerFsWorkflows(discovered)`.

**Why it works:** Workflows are already self-contained (they carry their own `id`, `inputSchema`, steps). No merging/assembly logic needed — just discover and register. Already the convention in most projects (`src/mastra/workflows/`).

#### 2. File-Based Tools (Global): `src/mastra/tools/<name>.ts`

```
src/mastra/tools/
  weather-tool.ts        → default-exports createTool({...})
  billing-tools.ts       → named exports of multiple createTool({...})
```

**Discovery rule:** Each `.ts`/`.js` file under `tools/` that default-exports a `createTool()` is registered as `tools[filename]`. Files with only named exports register each named export by its export name.

**Why it works:** The CLI already discovers tool paths for bundling (`getAllToolPaths`). This just extends that to auto-register them on the Mastra instance. Global tools are available to all agents and workflows via `mastra.getTool(id)`.

#### 3. File-Based Processors: `src/mastra/processors/<name>.ts`

```
src/mastra/processors/
  moderation.ts          → default-exports a Processor
  pii-detection.ts       → default-exports a Processor
```

**Discovery rule:** Each `.ts`/`.js` file under `processors/` that default-exports a `Processor` is registered as `processors[filename]`.

**Why it works:** Processors are self-contained objects with an `id` and `execute` function. Same discover-and-register pattern.

#### 4. File-Based Scorers: `src/mastra/scorers/<name>.ts`

```
src/mastra/scorers/
  accuracy.ts            → default-exports a MastraScorer
```

**Discovery rule:** Same pattern. Default export registered by filename.

#### 5. File-Based MCP Servers: `src/mastra/mcp/<name>.ts`

```
src/mastra/mcp/
  my-server.ts           → default-exports new MCPServer({...})
  apps-server.ts         → default-exports new MCPServer({...})
```

**Discovery rule:** Each file that default-exports an `MCPServer` (or `MCPClient.toMCPServerProxies()` result) is registered by filename.

---

### Tier 2: Infrastructure Config (requires a config file convention)

These aren't simple "one file = one primitive" — they're singleton infrastructure. A `mastra.config.ts` (or sections within `config.ts`) is the right convention.

#### 6. `src/mastra/config.ts` — The Mastra Configuration File

Instead of `new Mastra({...})` in `index.ts`, a dedicated config file exports infrastructure:

```ts
// src/mastra/config.ts
import { mastraConfig } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Observability, MastraStorageExporter } from '@mastra/observability'

export default mastraConfig({
  storage: new LibSQLStore({ url: 'file:./mastra.db' }),
  observability: new Observability({
    configs: { default: { serviceName: 'mastra', exporters: [new MastraStorageExporter()] } },
  }),
  server: {
    port: 4111,
  },
  gateways: {
    // custom gateways here
  },
})
```

**How it works:** The bundler discovers `config.ts` alongside `index.ts`. If present, it constructs the `Mastra` instance internally by merging discovered primitives with the config. If the user still exports `mastra` from `index.ts`, it's used as-is (backward compat). But if only `config.ts` exists and no `index.ts`, the bundler auto-constructs.

#### 7. File-Based Memory: `src/mastra/memory.ts`

```ts
// src/mastra/memory.ts
import { Memory } from '@mastra/memory'

export default new Memory({
  // global memory config
})
```

**Discovery rule:** A single `memory.ts` at the mastra root provides the global memory instance (used by stored agents that reference "default" memory). Multiple named exports could populate the `memory` registry.

#### 8. File-Based Vectors: `src/mastra/vectors/<name>.ts`

```ts
// src/mastra/vectors/knowledge.ts
import { PgVector } from '@mastra/pg'

export default new PgVector({ connectionString: process.env.DATABASE_URL })
```

#### 9. File-Based Channels: `src/mastra/channels/<name>.ts`

```ts
// src/mastra/channels/slack.ts
import { SlackProvider } from '@mastra/slack'

export default new SlackProvider({
  baseUrl: process.env.MASTRA_BASE_URL,
})
```

---

### Tier 3: The Zero-Config Endgame

With all of the above, the **minimum viable `index.ts`** becomes:

```ts
// src/mastra/index.ts — OPTIONAL, only needed for escape hatches
export { mastra } from './_generated' // or just deleted entirely
```

Or even better — **no `index.ts` at all**. The bundler constructs `Mastra` from:

```
src/mastra/
  config.ts              → infrastructure (storage, observability, server)
  memory.ts              → global memory
  agents/                → file-based agents (already works)
  workflows/             → file-based workflows
  tools/                 → file-based global tools
  processors/            → file-based processors
  mcp/                   → file-based MCP servers
  scorers/               → file-based scorers
  vectors/               → file-based vector stores
  channels/              → file-based channels
```

The generated entry becomes:

```ts
// .mastra-entry.mjs (generated by bundler)
import config from '<mastraDir>/config.ts'
import { assembleAgentFromFsEntry } from '@mastra/core/agent'
import { Mastra } from '@mastra/core'

// ... discover all primitives ...

export const mastra = new Mastra({
  ...config,
  agents: { ...discoveredAgents },
  workflows: { ...discoveredWorkflows },
  tools: { ...discoveredTools },
  processors: { ...discoveredProcessors },
  mcpServers: { ...discoveredMcpServers },
  scorers: { ...discoveredScorers },
  // etc.
})
```

---

## Implementation Priority

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| **Phase 1** | File-based workflows (`workflows/*.ts`) | Low — same pattern as agents | High — workflows are the #2 most common primitive |
| **Phase 2** | File-based global tools (`tools/*.ts`) | Low | Medium — most tools live on agents already |
| **Phase 3** | File-based processors + scorers | Low | Medium |
| **Phase 4** | `config.ts` convention (infra singleton) | Medium — needs bundler changes | High — removes the Mastra constructor |
| **Phase 5** | File-based MCP, vectors, channels, memory | Low per primitive | Completes the paradigm |
| **Phase 6** | Optional `index.ts` — full auto-construction | Medium | Maximum DX — zero boilerplate |

---

## Design Principles (carried from file-based agents)

1. **Code always wins on collision** — if a primitive is registered both in code and via filesystem, code takes precedence with a warning.
2. **Gradual adoption** — every convention is opt-in. Existing `index.ts` projects work unchanged.
3. **No runtime filesystem access** — all discovery happens at build time; the bundle is self-contained.
4. **Identity helper for typing** — like `agentConfig()`, provide `workflowConfig()`, `toolConfig()`, etc. that give editor types without changing behavior.
5. **Stable, sorted discovery** — directory entries are sorted for deterministic builds.
6. **Test files excluded** — `*.test.ts` / `*.spec.ts` patterns are never discovered.

---

## What This Enables

- **New users** get a "just add files" experience — no import juggling, no index.ts ceremony
- **File-first is framework-standard** (Next.js pages, Remix routes, Astro content collections, SvelteKit routes)
- **AI-assisted development** — tools that generate agents/workflows can just drop files without modifying a central registry
- **Better git diffs** — adding a workflow is a single new file, not a new file + 2-line edit to index.ts
- **Studio/Builder parity** — the Agent Builder already uses stored primitives; file-based primitives bridge the gap between code and config
