---
date: 2026-01-23T20:29:12Z
researcher: ryanhansen
git_commit: 73d26cfabdfcd0e086f7f35c36753e4ff0cb73a9
branch: mastra-admin-rph
repository: mastra-ai/mastra
topic: "Mastra Architecture Research for MastraAdmin Implementation"
tags: [research, codebase, architecture, mastra-admin, plugin-patterns, dependency-injection]
status: complete
last_updated: 2026-01-23
last_updated_by: ryanhansen
---

# Research: Mastra Architecture for MastraAdmin Implementation

**Date**: 2026-01-23T20:29:12Z
**Researcher**: ryanhansen
**Git Commit**: 73d26cfabdfcd0e086f7f35c36753e4ff0cb73a9
**Branch**: mastra-admin-rph
**Repository**: mastra-ai/mastra

## Research Question

Research the existing Mastra codebase architecture to understand:
1. How core classes are structured (e.g., the main Mastra class)
2. Existing provider/plugin patterns and interfaces
3. How storage, auth, and other pluggable components are implemented
4. The package structure and how packages relate to each other
5. TypeScript patterns used (abstract classes vs interfaces, dependency injection, etc.)

Purpose: Implement a new MastraAdmin class following existing patterns for a self-hosted admin platform with pluggable providers for auth, storage, runners, billing, and observability.

## Summary

The Mastra framework implements a **central orchestrator pattern** where the `Mastra` class acts as a dependency injection container and service locator for all framework components. Key architectural patterns include:

1. **Abstract Base Classes**: Pluggable components extend abstract base classes (`MastraVector`, `MastraMemory`, `StorageDomain`, `MastraAuthProvider`)
2. **Configuration Objects with Generics**: Heavy use of generic interfaces with defaults for type-safe component configuration
3. **Plugin Registration**: Components registered via `add*()` methods with automatic dependency injection
4. **Domain-Oriented Storage**: Storage uses a composite pattern with 5 specialized domains (memory, workflows, scores, observability, agents)
5. **Lazy Initialization**: Proxy-based auto-initialization for storage to prevent race conditions

These patterns should be replicated in the MastraAdmin implementation for consistency.

## Detailed Findings

### 1. Core Mastra Class Architecture

**Location**: `packages/core/src/mastra/index.ts`

#### Configuration Interface (lines 87-233)

The `Config` interface uses extensive generic type parameters with defaults:

```typescript
export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, Workflow<any, any, any, any, any, any, any>> = Record<...>,
  TVectors extends Record<string, MastraVector<any>> = Record<string, MastraVector<any>>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends IMastraLogger = IMastraLogger,
  TMCPServers extends Record<string, MCPServerBase<any>> = Record<string, MCPServerBase<any>>,
  TScorers extends Record<string, MastraScorer<any, any, any, any>> = Record<...>,
  TTools extends Record<string, ToolAction<any, any, any, any, any, any>> = Record<...>,
  TProcessors extends Record<string, Processor<any>> = Record<string, Processor<any>>,
  TMemory extends Record<string, MastraMemory> = Record<string, MastraMemory>,
> {
  agents?: { [K in keyof TAgents]: TAgents[K] | ToolLoopAgentLike };
  storage?: MastraCompositeStore;
  vectors?: TVectors;
  logger?: TLogger | false;
  workflows?: TWorkflows;
  // ... more fields
}
```

**Pattern to follow for MastraAdmin**: Use generic type parameters with sensible defaults for provider records.

#### Private Fields with # Syntax (lines 286-319)

The Mastra class uses JavaScript private fields for encapsulation:

```typescript
#vectors: TVectors;
#agents: TAgents;
#logger: IMastraLogger;
#workflows: TWorkflows;
#storage?: MastraCompositeStore;
#memory: TMemory;
```

#### Constructor Registration Flow (lines 431-618)

Components are registered in a specific order to handle dependencies:

1. Initialize empty registries first (prevent circular deps)
2. Set up pub/sub and logger
3. Augment storage with auto-init wrapper
4. Register components in dependency order:
   - Tools → Processors → Memory → Vectors → Scorers → Workflows → Gateways → MCP Servers → Agents → TTS

```typescript
constructor(config?: Config<...>) {
  // Initialize empty registries first
  this.#vectors = {} as TVectors;
  this.#agents = {} as TAgents;
  // ...

  // Add primitives - ORDER MATTERS
  if (config?.tools) {
    Object.entries(config.tools).forEach(([key, tool]) => {
      if (tool != null) this.addTool(tool, key);
    });
  }
  // ... more registrations in specific order
}
```

#### Component Registration Pattern (lines 1253-1297 for agents)

All `add*()` methods follow the same pattern:

```typescript
public addAgent<A extends Agent>(agent: A, key?: string): void {
  // 1. Null/undefined validation
  if (!agent) {
    throw createUndefinedPrimitiveError('agent', agent, key);
  }

  // 2. Key resolution
  const agentKey = key || agent.id;

  // 3. Duplicate check
  if (agents[agentKey]) {
    logger.debug(`Agent with key ${agentKey} already exists. Skipping.`);
    return;
  }

  // 4. Dependency injection
  agent.__setLogger(this.#logger);
  agent.__registerMastra(this);
  agent.__registerPrimitives({
    logger: this.getLogger(),
    storage: this.getStorage(),
    agents: agents,
    tts: this.#tts,
    vectors: this.#vectors,
  });

  // 5. Registry addition
  agents[agentKey] = agent;
}
```

#### Getter Methods

Three access patterns for components:

1. **By registration key**: `getAgent(name)` - throws if not found
2. **By internal ID**: `getAgentById(id)` - searches by ID, falls back to key
3. **List all**: `listAgents()` - returns all registered components

---

### 2. Storage Implementation Pattern

**Location**: `packages/core/src/storage/`

#### Domain-Based Architecture

Storage is divided into 5 specialized domains, each with an abstract base class:

| Domain | Base Class | Purpose |
|--------|-----------|---------|
| `memory` | `MemoryStorage` | Thread/message persistence |
| `workflows` | `WorkflowsStorage` | Workflow state and execution |
| `scores` | `ScoresStorage` | Evaluation score storage |
| `observability` | `ObservabilityStorage` | Traces and spans |
| `agents` | `AgentsStorage` | Agent configurations with versioning |

#### MastraCompositeStore (base.ts lines 123-261)

Central storage class that composes domain stores:

```typescript
export abstract class MastraCompositeStore extends MastraBase {
  stores?: {
    memory?: MemoryStorage;
    workflows?: WorkflowsStorage;
    scores?: ScoresStorage;
    observability?: ObservabilityStorage;
    agents?: AgentsStorage;
  };

  getStore<K extends keyof typeof this.stores>(domain: K) {
    return this.stores?.[domain];
  }

  async init(): Promise<void> {
    // Initialize all domain stores
    await Promise.all([
      this.stores?.memory?.init(),
      this.stores?.workflows?.init(),
      // ...
    ]);
  }
}
```

#### Domain Composition Pattern

Storage backends can be mixed per domain:

```typescript
const storage = new MastraCompositeStore({
  id: 'composite',
  default: pgStore,
  domains: {
    memory: libsqlStore.stores?.memory,    // LibSQL for memory
    workflows: pgStore.stores?.workflows,   // Postgres for workflows
  },
});
```

#### Concrete Implementation Example (PostgreSQL)

**Location**: `stores/pg/src/storage/index.ts`

```typescript
export class PostgresStore extends MastraCompositeStore {
  constructor(config: PgStoreConfig) {
    validateConfig('PostgresStore', config);
    const schemaName = parseSqlIdentifier(config.schemaName || 'mastra');

    const pool = config.pool ?? createPool(config);
    const domainConfig = { client: new PoolAdapter(pool), schemaName };

    super({
      id: 'postgres',
      name: 'PostgreSQL',
      stores: {
        scores: new ScoresPG(domainConfig),
        workflows: new WorkflowsPG(domainConfig),
        memory: new MemoryPG(domainConfig),
        observability: new ObservabilityPG(domainConfig),
        agents: new AgentsPG(domainConfig),
      },
    });
  }
}
```

#### Auto-Initialization Pattern (storageWithInit.ts)

```typescript
export function augmentWithInit(store: MastraCompositeStore): MastraCompositeStore {
  let initPromise: Promise<void> | null = null;

  return new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value === 'function') {
        return async (...args: any[]) => {
          // Auto-init before any method call
          if (!initPromise) {
            initPromise = target.init();
          }
          await initPromise;
          return value.apply(target, args);
        };
      }
      return value;
    },
  });
}
```

---

### 3. Authentication Pattern

**Location**: `packages/core/src/server/auth.ts`

#### Abstract Provider Pattern

```typescript
export abstract class MastraAuthProvider<TUser = unknown> extends MastraBase {
  public protected?: (RegExp | string | [string, Methods | Methods[]])[];
  public public?: (RegExp | string | [string, Methods | Methods[]])[];

  constructor(opts?: MastraAuthProviderOptions<TUser>) {
    super({ name: 'MastraAuthProvider', component: 'AUTH' });
    this.registerOptions(opts);
  }

  abstract authenticateToken(token: string, request: HonoRequest): Promise<TUser | null>;
  abstract authorizeUser(user: TUser, request: HonoRequest): Promise<boolean> | boolean;
}
```

#### Concrete Provider Example (Auth0)

**Location**: `auth/auth0/src/index.ts`

```typescript
export class MastraAuthAuth0 extends MastraAuthProvider<Auth0User> {
  private domain: string;
  private audience: string;

  constructor(opts?: MastraAuthAuth0Options) {
    super(opts);
    this.domain = opts?.domain ?? process.env.AUTH0_DOMAIN ?? '';
    this.audience = opts?.audience ?? process.env.AUTH0_AUDIENCE ?? '';
  }

  async authenticateToken(token: string): Promise<Auth0User | null> {
    const JWKS = jose.createRemoteJWKSet(
      new URL(`https://${this.domain}/.well-known/jwks.json`)
    );
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `https://${this.domain}/`,
      audience: this.audience,
    });
    return payload as Auth0User;
  }

  async authorizeUser(user: Auth0User): Promise<boolean> {
    return !!user.sub && (!user.exp || user.exp > Date.now() / 1000);
  }
}
```

#### Composite Auth Pattern

**Location**: `packages/core/src/server/composite-auth.ts`

```typescript
export class CompositeAuth extends MastraAuthProvider {
  constructor(private providers: MastraAuthProvider[]) {
    super();
  }

  async authenticateToken(token: string, request: HonoRequest) {
    for (const provider of this.providers) {
      try {
        const user = await provider.authenticateToken(token, request);
        if (user) return user;
      } catch {}
    }
    return null;
  }

  async authorizeUser(user: any, request: HonoRequest) {
    for (const provider of this.providers) {
      if (await provider.authorizeUser(user, request)) return true;
    }
    return false;
  }
}
```

---

### 4. Package Structure

#### Core Framework Packages (`packages/`)

| Package | Name | Purpose |
|---------|------|---------|
| `core` | `@mastra/core` | Main framework (agents, tools, workflows, storage interfaces) |
| `server` | `@mastra/server` | HTTP server implementation with Hono |
| `deployer` | `@mastra/deployer` | Deployment bundling system |
| `memory` | `@mastra/memory` | Thread-based conversation memory |
| `auth` | `@mastra/auth` | Base authentication utilities |
| `mcp` | `@mastra/mcp` | Model Context Protocol integration |
| `rag` | `@mastra/rag` | Retrieval-Augmented Generation |
| `evals` | `@mastra/evals` | Evaluation framework |

#### Storage Adapters (`stores/`)

All implement `MastraCompositeStore` with domain stores:
- `@mastra/pg` - PostgreSQL
- `@mastra/libsql` - LibSQL/Turso
- `@mastra/mongodb` - MongoDB
- `@mastra/dynamodb` - AWS DynamoDB

#### Auth Providers (`auth/`)

All extend `MastraAuthProvider<TUser>`:
- `@mastra/auth-auth0`
- `@mastra/auth-clerk`
- `@mastra/auth-firebase`
- `@mastra/auth-supabase`
- `@mastra/auth-workos`
- `@mastra/auth-better-auth`

#### Observability Providers (`observability/`)

All implement observability integration:
- `@mastra/observability` - Base package
- `@mastra/langfuse`, `@mastra/langsmith`, `@mastra/braintrust`
- `@mastra/datadog`, `@mastra/sentry`, `@mastra/posthog`

#### Dependency Pattern

```
@mastra/core (foundation)
  ├── Used by most packages as peer/dev dependency
  └── Peer dependency: zod ^3.25.0 || ^4.0.0

@mastra/server
  └── Used by: deployers, server-adapters

@mastra/auth (base)
  └── Used by: auth-* packages

@mastra/observability (base)
  └── Used by: observability provider packages
```

---

### 5. TypeScript Patterns

#### Abstract Base Classes

Used for pluggable components with required contracts:

```typescript
// Vector stores
export abstract class MastraVector<Filter = VectorFilter> extends MastraBase {
  abstract query(params: QueryVectorParams<Filter>): Promise<QueryResult[]>;
  abstract upsert(params: UpsertVectorParams): Promise<string[]>;
  abstract createIndex(params: CreateIndexParams): Promise<void>;
  // ...
}

// Storage domains
export abstract class StorageDomain extends MastraBase {
  async init(): Promise<void> { /* default no-op */ }
  abstract dangerouslyClearAll(): Promise<void>;
}
```

#### Interfaces for Configuration

Used for configuration objects and data structures:

```typescript
export interface AgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> {
  id: TAgentId;
  name: string;
  instructions: DynamicAgentInstructions;
  model: MastraModelConfig | DynamicModel | ModelWithRetries[];
  tools?: DynamicArgument<TTools>;
  // ...
}
```

#### Dependency Injection via Constructor

```typescript
export class Agent<TAgentId, TTools, TOutput> extends MastraBase {
  #mastra?: Mastra;

  constructor(config: AgentConfig<TAgentId, TTools, TOutput>) {
    super({ component: 'AGENT', name: config.name });
    // Store config fields
    if (config.mastra) {
      this.__registerMastra(config.mastra);
    }
  }

  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }
}
```

#### Double-Underscore Methods for Framework Internals

```typescript
// Used by Mastra class to inject dependencies
__setLogger(logger: IMastraLogger): void
__registerMastra(mastra: Mastra): void
__registerPrimitives(primitives: PrimitivesRegistry): void
```

#### Discriminated Unions for State

```typescript
export type StepResult<P, R, S, T> =
  | { status: 'success'; output: T; /* ... */ }
  | { status: 'failed'; error: Error; /* ... */ }
  | { status: 'suspended'; suspendPayload: S; /* ... */ }
  | { status: 'running'; /* ... */ }
  | { status: 'waiting'; /* ... */ };
```

#### Generic Constraints with Defaults

```typescript
export interface Config<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TStorage extends MastraCompositeStore = MastraCompositeStore,
> {
  agents?: TAgents;
  storage?: TStorage;
}
```

---

## Architecture Recommendations for MastraAdmin

Based on the patterns found, the MastraAdmin class should follow these conventions:

### 1. Configuration Interface

```typescript
import type { MastraAuthProvider } from '@mastra/core/server';

export interface MastraAdminConfig<
  TStorage extends AdminStorage = AdminStorage,
  TObservability extends ObservabilityProvider = ObservabilityProvider,
  TRunner extends ProjectRunner = ProjectRunner,
  TSource extends ProjectSourceProvider = ProjectSourceProvider,
> {
  // Auth: reuse existing MastraAuthProvider from @mastra/auth-*
  // No admin-specific auth abstraction needed
  auth: MastraAuthProvider;

  storage: TStorage;
  observability?: TObservability;
  runner?: TRunner;
  source?: TSource;
  billing?: BillingProvider;
  email?: EmailProvider;
  encryption?: EncryptionProvider;
  logger?: IMastraLogger | false;
}
```

**Key Decision**: Reuse existing `MastraAuthProvider` from `@mastra/auth-*` packages (e.g., `@mastra/auth-supabase`, `@mastra/auth-clerk`). Admin-specific authorization (RBAC, team permissions) is handled by `RBACManager` in the admin core, not in the auth provider.

### 2. Abstract Provider Base Classes

```typescript
// NOTE: No AdminAuthProvider - we reuse existing MastraAuthProvider

export abstract class AdminStorage extends MastraBase {
  abstract init(): Promise<void>;
  abstract getProjects(userId: string): Promise<Project[]>;
  abstract createProject(input: CreateProjectInput): Promise<Project>;
  // ... other admin-specific storage methods
}

export abstract class ProjectRunner extends MastraBase {
  abstract start(project: Project): Promise<RunningProcess>;
  abstract stop(processId: string): Promise<void>;
  abstract getStatus(processId: string): Promise<ProcessStatus>;
  // ...
}

export abstract class ProjectSourceProvider {
  abstract readonly type: 'local' | 'github' | string;
  abstract listProjects(teamId: string): Promise<ProjectSource[]>;
  abstract getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;
  // ...
}

export abstract class ObservabilityProvider extends MastraBase {
  abstract ingestTrace(trace: Trace): Promise<void>;
  abstract queryTraces(filter: TraceFilter): Promise<Trace[]>;
  // ...
}
```

### 3. Main Class Structure

```typescript
import type { MastraAuthProvider } from '@mastra/core/server';

export class MastraAdmin extends MastraBase {
  #auth: MastraAuthProvider;  // Reuse existing auth provider
  #storage: AdminStorage;
  #runner?: ProjectRunner;
  #source?: ProjectSourceProvider;
  #observability?: ObservabilityProvider;
  #logger: IMastraLogger;
  #rbac: RBACManager;  // Admin-specific authorization

  constructor(config: MastraAdminConfig<...>) {
    super({ component: 'MASTRA_ADMIN', name: 'MastraAdmin' });

    // Initialize logger
    this.#logger = config.logger === false
      ? noopLogger
      : config.logger ?? new ConsoleLogger();

    // Register auth provider (reused from @mastra/auth-*)
    this.#auth = config.auth;

    // Register storage
    this.#storage = config.storage;
    this.#storage.__setLogger(this.#logger);

    // Initialize RBAC manager for admin-specific authorization
    this.#rbac = new RBACManager(this.#storage);

    // Register optional providers
    if (config.runner) {
      this.#runner = config.runner;
      this.#runner.__setLogger(this.#logger);
    }
    // ...
  }

  getAuth(): MastraAuthProvider { return this.#auth; }
  getStorage(): AdminStorage { return this.#storage; }
  getRBAC(): RBACManager { return this.#rbac; }
  getRunner(): ProjectRunner | undefined { return this.#runner; }
  // ...
}
```

### 4. Directory Structure (Following Existing Patterns)

The structure follows established Mastra conventions where implementations live in top-level directories:

```
# Core package with base classes and interfaces
packages/admin/
├── src/
│   ├── index.ts                 # Main exports
│   ├── mastra-admin.ts          # MastraAdmin class
│   ├── types.ts                 # Shared types
│   ├── errors.ts                # Error classes
│   ├── providers/
│   │   ├── storage/base.ts      # AdminStorage abstract class
│   │   ├── runner/base.ts       # ProjectRunner abstract class
│   │   ├── source/base.ts       # ProjectSourceProvider interface
│   │   ├── observability/base.ts
│   │   ├── billing/base.ts
│   │   ├── billing/no-billing.ts      # Built-in NoBillingProvider
│   │   ├── email/base.ts
│   │   ├── email/console.ts           # Built-in ConsoleEmailProvider
│   │   ├── encryption/base.ts
│   │   └── encryption/node-crypto.ts  # Built-in NodeCryptoProvider
│   └── rbac/
│       ├── manager.ts           # RBACManager for admin authorization
│       ├── roles.ts
│       └── types.ts
├── package.json
└── tsconfig.json

# Admin UI (standalone app)
packages/admin-ui/               → @mastra/admin-ui

# Storage implementations (follows stores/pg/ pattern)
stores/admin-pg/                 → @mastra/admin-pg
stores/admin-clickhouse/         → @mastra/admin-clickhouse

# Runner implementations (new top-level directory, similar to deployers/)
runners/local/                   → @mastra/runner-local
runners/k8s/                     → @mastra/runner-k8s

# Source implementations (new top-level directory)
sources/local/                   → @mastra/source-local
sources/github/                  → @mastra/source-github

# Auth: Reuse existing packages directly - NO new packages needed
auth/supabase/                   → @mastra/auth-supabase (existing)
auth/clerk/                      → @mastra/auth-clerk (existing)
auth/auth0/                      → @mastra/auth-auth0 (existing)
```

**Rationale:**
- `stores/` - Matches existing `stores/pg/`, `stores/libsql/` pattern
- `runners/` - New top-level directory for runner implementations (similar to `deployers/`)
- `sources/` - New top-level directory for project source implementations
- `auth/` - **Reuse existing auth providers** - no admin-specific packages needed

## Code References

### Core Architecture
- `packages/core/src/mastra/index.ts:87-233` - Config interface with generics
- `packages/core/src/mastra/index.ts:431-618` - Constructor and registration flow
- `packages/core/src/mastra/index.ts:1253-1297` - addAgent() pattern
- `packages/core/src/base.ts:5-27` - MastraBase class

### Storage Pattern
- `packages/core/src/storage/base.ts:123-261` - MastraCompositeStore
- `packages/core/src/storage/domains/base.ts:7-23` - StorageDomain abstract class
- `packages/core/src/storage/storageWithInit.ts:5-66` - Auto-initialization wrapper
- `stores/pg/src/storage/index.ts:58-194` - PostgresStore implementation

### Auth Pattern
- `packages/core/src/server/auth.ts:18-60` - MastraAuthProvider abstract class
- `packages/core/src/server/composite-auth.ts:4-35` - CompositeAuth
- `auth/auth0/src/index.ts:14-64` - Auth0 implementation

### TypeScript Patterns
- `packages/core/src/vector/vector.ts:70-140` - Abstract class with generics
- `packages/core/src/agent/types.ts:129-154` - Configuration type patterns
- `packages/core/src/workflows/types.ts:53-140` - Discriminated unions

## Related Research

This research provides the foundation for implementing the MastraAdmin class. Key patterns to replicate:
1. Generic config interfaces with defaults
2. Abstract provider base classes (for storage, runners, sources - NOT auth)
3. **Reuse existing auth providers** from `@mastra/auth-*` packages
4. Constructor-based dependency injection
5. Double-underscore methods for framework internals
6. Private fields (#) for encapsulation
7. Lazy initialization with proxy wrappers (for storage)
8. **Follow existing directory conventions** (stores/, auth/, new runners/, sources/)

## Open Questions

1. Should MastraAdmin integrate with the existing Mastra class, or be completely separate?
2. How should the admin storage schema relate to the existing Mastra storage domains?
3. ~~Should admin providers be able to use existing auth providers (e.g., reuse `@mastra/auth-clerk`)?~~
   **RESOLVED**: Yes, reuse existing `@mastra/auth-*` providers directly. Admin-specific authorization (RBAC, team permissions) is handled by `RBACManager` in the admin core package.
4. What level of multi-tenancy isolation is needed between projects?
