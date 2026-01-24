# LANE 12: @mastra/router-local - Local Edge Router

**Package**: `@mastra/router-local`
**Location**: `routers/local/`
**Priority**: P1 (Phase 2 - parallel with other Layer 1 components)
**Dependencies**: LANE 1 (`@mastra/admin` - EdgeRouterProvider interface)

## Overview

The local edge router provides development-friendly routing for Mastra servers running on localhost. It exposes locally running Mastra deployments through configurable routing strategies, making development and testing feel like production.

### Purpose

- **Development**: Route requests to local Mastra servers during development
- **Port Management**: Auto-allocate ports and maintain port mappings
- **Local Domains**: Optional custom local domain support (e.g., `project.mastra.local`)
- **Health Monitoring**: Track health of local services with HTTP checks
- **Reverse Proxy**: Optional HTTP proxy for unified entry point

## Interface Implementation

Implements `EdgeRouterProvider` from `@mastra/admin`:

```typescript
export interface EdgeRouterProvider {
  readonly type: 'local' | 'cloudflare' | string;
  registerRoute(config: RouteConfig): Promise<RouteInfo>;
  updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo>;
  removeRoute(routeId: string): Promise<void>;
  getRoute(deploymentId: string): Promise<RouteInfo | null>;
  listRoutes(projectId: string): Promise<RouteInfo[]>;
  checkRouteHealth(routeId: string): Promise<RouteHealthStatus>;
}
```

## Design Decisions

| Decision                  | Choice                                           | Rationale                                                             |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| **Routing Strategies**    | Port mapping (default), Reverse proxy (optional) | Port mapping is simplest; proxy adds overhead but unified entry point |
| **In-Memory State**       | Yes, with optional persistence                   | Development use case doesn't require durability                       |
| **Hosts File Management** | Optional, disabled by default                    | Requires elevated permissions, not always needed                      |
| **Local HTTPS**           | Optional, using self-signed certs                | Useful for testing but adds setup complexity                          |
| **Health Check Method**   | HTTP GET to `/health` or configurable path       | Standard approach, works with Mastra servers                          |
| **Proxy Library**         | `http-proxy`                                     | Well-maintained, battle-tested, supports WebSocket                    |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LocalEdgeRouter                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │   RouteRegistry  │    │  HealthChecker   │    │  PortManager  │ │
│  │  (in-memory map) │    │  (HTTP checks)   │    │ (allocation)  │ │
│  └────────┬─────────┘    └────────┬─────────┘    └───────┬───────┘ │
│           │                       │                       │         │
│           └───────────────────────┼───────────────────────┘         │
│                                   │                                  │
│  ┌────────────────────────────────┴────────────────────────────────┐│
│  │                    Optional Components                          ││
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐  ││
│  │  │  ReverseProxy    │  │  HostsManager   │  │  TLSManager    │  ││
│  │  │  (http-proxy)    │  │  (/etc/hosts)   │  │  (self-signed) │  ││
│  │  └──────────────────┘  └─────────────────┘  └────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
routers/local/
├── src/
│   ├── index.ts                    # Package exports
│   ├── router.ts                   # LocalEdgeRouter implementation
│   ├── types.ts                    # Configuration and internal types
│   ├── registry.ts                 # RouteRegistry - in-memory route storage
│   ├── health-checker.ts           # HTTP health checking
│   ├── port-manager.ts             # Port allocation and tracking
│   ├── proxy/                      # Optional reverse proxy
│   │   ├── index.ts
│   │   └── proxy-server.ts
│   ├── hosts/                      # Optional hosts file management
│   │   └── hosts-manager.ts
│   ├── tls/                        # Optional TLS support
│   │   └── tls-manager.ts
│   └── utils.ts                    # Helper functions
├── tests/
│   ├── router.test.ts
│   ├── registry.test.ts
│   ├── health-checker.test.ts
│   └── port-manager.test.ts
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── vitest.config.ts
└── CHANGELOG.md
```

## Implementation Details

### 1. Configuration Types (`types.ts`)

```typescript
import type { RouteConfig, RouteInfo, RouteHealthStatus } from '@mastra/admin';

/**
 * Routing strategy for local router.
 */
export type RoutingStrategy = 'port-mapping' | 'reverse-proxy';

/**
 * Configuration for LocalEdgeRouter.
 */
export interface LocalEdgeRouterConfig {
  /**
   * Routing strategy to use.
   * - 'port-mapping': Direct port exposure (default)
   * - 'reverse-proxy': HTTP proxy on single port
   * @default 'port-mapping'
   */
  strategy?: RoutingStrategy;

  /**
   * Base domain for local routes.
   * @default 'localhost'
   * @example 'mastra.local' for custom local domains
   */
  baseDomain?: string;

  /**
   * Port range for auto-allocation.
   * @default { start: 3100, end: 3199 }
   */
  portRange?: {
    start: number;
    end: number;
  };

  /**
   * Reverse proxy port (when strategy is 'reverse-proxy').
   * @default 3000
   */
  proxyPort?: number;

  /**
   * Health check configuration.
   */
  healthCheck?: {
    /** Health check endpoint path. @default '/health' */
    path?: string;
    /** Health check interval in ms. @default 30000 */
    intervalMs?: number;
    /** Health check timeout in ms. @default 5000 */
    timeoutMs?: number;
    /** Number of failures before marking unhealthy. @default 3 */
    failureThreshold?: number;
  };

  /**
   * Enable hosts file management for custom local domains.
   * Requires elevated permissions.
   * @default false
   */
  enableHostsFile?: boolean;

  /**
   * Enable local HTTPS with self-signed certificates.
   * @default false
   */
  enableTls?: boolean;

  /**
   * TLS configuration (when enableTls is true).
   */
  tls?: {
    /** Directory to store certificates. @default '~/.mastra/certs' */
    certDir?: string;
    /** Certificate validity in days. @default 365 */
    validityDays?: number;
  };

  /**
   * Enable console logging of route changes.
   * @default true
   */
  logRoutes?: boolean;
}

/**
 * Internal route record with additional metadata.
 */
export interface LocalRoute {
  routeId: string;
  deploymentId: string;
  projectId: string;
  subdomain: string;
  targetHost: string;
  targetPort: number;
  publicUrl: string;
  status: RouteStatus;
  tls: boolean;
  createdAt: Date;
  lastHealthCheck?: Date;
  healthCheckFailures: number;
}
```

### 2. Route Registry (`registry.ts`)

```typescript
import type { RouteStatus } from '@mastra/admin';
import type { LocalRoute } from './types';

/**
 * In-memory route registry for local routing.
 */
export class RouteRegistry {
  private routes: Map<string, LocalRoute> = new Map();
  private byDeploymentId: Map<string, string> = new Map();
  private byProjectId: Map<string, Set<string>> = new Map();

  /**
   * Add a new route to the registry.
   */
  add(route: LocalRoute): void {
    this.routes.set(route.routeId, route);
    this.byDeploymentId.set(route.deploymentId, route.routeId);

    const projectRoutes = this.byProjectId.get(route.projectId) ?? new Set();
    projectRoutes.add(route.routeId);
    this.byProjectId.set(route.projectId, projectRoutes);
  }

  /**
   * Get route by ID.
   */
  get(routeId: string): LocalRoute | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get route by deployment ID.
   */
  getByDeploymentId(deploymentId: string): LocalRoute | undefined {
    const routeId = this.byDeploymentId.get(deploymentId);
    return routeId ? this.routes.get(routeId) : undefined;
  }

  /**
   * List routes for a project.
   */
  listByProjectId(projectId: string): LocalRoute[] {
    const routeIds = this.byProjectId.get(projectId);
    if (!routeIds) return [];
    return Array.from(routeIds)
      .map(id => this.routes.get(id))
      .filter((r): r is LocalRoute => r !== undefined);
  }

  /**
   * Update a route.
   */
  update(routeId: string, updates: Partial<LocalRoute>): LocalRoute | undefined {
    const route = this.routes.get(routeId);
    if (!route) return undefined;

    const updated = { ...route, ...updates };
    this.routes.set(routeId, updated);
    return updated;
  }

  /**
   * Remove a route.
   */
  remove(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;

    this.routes.delete(routeId);
    this.byDeploymentId.delete(route.deploymentId);

    const projectRoutes = this.byProjectId.get(route.projectId);
    if (projectRoutes) {
      projectRoutes.delete(routeId);
      if (projectRoutes.size === 0) {
        this.byProjectId.delete(route.projectId);
      }
    }

    return true;
  }

  /**
   * Get all routes.
   */
  all(): LocalRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all routes.
   */
  clear(): void {
    this.routes.clear();
    this.byDeploymentId.clear();
    this.byProjectId.clear();
  }
}
```

### 3. Port Manager (`port-manager.ts`)

```typescript
import * as net from 'node:net';

export interface PortManagerConfig {
  start: number;
  end: number;
}

/**
 * Manages port allocation for local routing.
 */
export class PortManager {
  private allocatedPorts: Set<number> = new Set();
  private readonly range: PortManagerConfig;

  constructor(config: PortManagerConfig) {
    this.range = config;
  }

  /**
   * Allocate an available port.
   */
  async allocate(): Promise<number> {
    for (let port = this.range.start; port <= this.range.end; port++) {
      if (this.allocatedPorts.has(port)) continue;

      if (await this.isPortAvailable(port)) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    throw new Error(`No available ports in range ${this.range.start}-${this.range.end}`);
  }

  /**
   * Reserve a specific port.
   */
  async reserve(port: number): Promise<boolean> {
    if (this.allocatedPorts.has(port)) return false;
    if (!(await this.isPortAvailable(port))) return false;

    this.allocatedPorts.add(port);
    return true;
  }

  /**
   * Release an allocated port.
   */
  release(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Check if a port is available.
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Get all allocated ports.
   */
  getAllocated(): number[] {
    return Array.from(this.allocatedPorts);
  }
}
```

### 4. Health Checker (`health-checker.ts`)

```typescript
import type { RouteHealthStatus } from '@mastra/admin';
import type { LocalRoute } from './types';

export interface HealthCheckConfig {
  path: string;
  timeoutMs: number;
  failureThreshold: number;
}

/**
 * Performs HTTP health checks on routes.
 */
export class HealthChecker {
  private readonly config: HealthCheckConfig;

  constructor(config: HealthCheckConfig) {
    this.config = config;
  }

  /**
   * Check health of a route.
   */
  async check(route: LocalRoute): Promise<RouteHealthStatus> {
    const url = `http://${route.targetHost}:${route.targetPort}${this.config.path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          latencyMs,
          statusCode: response.status,
        };
      }

      return {
        healthy: false,
        latencyMs,
        statusCode: response.status,
        error: `Non-OK response: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            healthy: false,
            latencyMs,
            error: `Health check timed out after ${this.config.timeoutMs}ms`,
          };
        }
        return {
          healthy: false,
          latencyMs,
          error: error.message,
        };
      }

      return {
        healthy: false,
        latencyMs,
        error: 'Unknown error during health check',
      };
    }
  }

  /**
   * Determine if route should be marked unhealthy.
   */
  shouldMarkUnhealthy(failureCount: number): boolean {
    return failureCount >= this.config.failureThreshold;
  }
}
```

### 5. LocalEdgeRouter (`router.ts`)

````typescript
import { randomUUID } from 'node:crypto';
import type { EdgeRouterProvider, RouteConfig, RouteHealthStatus, RouteInfo, RouteStatus } from '@mastra/admin';
import { HealthChecker } from './health-checker';
import { PortManager } from './port-manager';
import { RouteRegistry } from './registry';
import type { LocalEdgeRouterConfig, LocalRoute } from './types';

const DEFAULT_CONFIG: Required<Omit<LocalEdgeRouterConfig, 'tls'>> = {
  strategy: 'port-mapping',
  baseDomain: 'localhost',
  portRange: { start: 3100, end: 3199 },
  proxyPort: 3000,
  healthCheck: {
    path: '/health',
    intervalMs: 30000,
    timeoutMs: 5000,
    failureThreshold: 3,
  },
  enableHostsFile: false,
  enableTls: false,
  logRoutes: true,
};

/**
 * Local edge router for development environments.
 *
 * Implements EdgeRouterProvider to manage routing for locally running
 * Mastra servers. Supports port mapping and optional reverse proxy strategies.
 *
 * @example
 * ```typescript
 * const router = new LocalEdgeRouter({
 *   baseDomain: 'localhost',
 *   portRange: { start: 3100, end: 3199 },
 * });
 *
 * // Register a route
 * const route = await router.registerRoute({
 *   deploymentId: 'deploy-123',
 *   projectId: 'project-456',
 *   subdomain: 'my-agent',
 *   targetHost: 'localhost',
 *   targetPort: 3001,
 * });
 * // route.publicUrl = 'http://localhost:3001'
 *
 * // Check health
 * const health = await router.checkRouteHealth(route.routeId);
 * ```
 */
export class LocalEdgeRouter implements EdgeRouterProvider {
  readonly type = 'local' as const;

  private readonly config: Required<Omit<LocalEdgeRouterConfig, 'tls'>> & { tls?: LocalEdgeRouterConfig['tls'] };
  private readonly registry: RouteRegistry;
  private readonly portManager: PortManager;
  private readonly healthChecker: HealthChecker;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: LocalEdgeRouterConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      healthCheck: { ...DEFAULT_CONFIG.healthCheck, ...config.healthCheck },
      portRange: config.portRange ?? DEFAULT_CONFIG.portRange,
    };

    this.registry = new RouteRegistry();
    this.portManager = new PortManager(this.config.portRange);
    this.healthChecker = new HealthChecker({
      path: this.config.healthCheck.path!,
      timeoutMs: this.config.healthCheck.timeoutMs!,
      failureThreshold: this.config.healthCheck.failureThreshold!,
    });
  }

  /**
   * Register a new route for a deployment.
   */
  async registerRoute(config: RouteConfig): Promise<RouteInfo> {
    // Check for existing route
    const existing = this.registry.getByDeploymentId(config.deploymentId);
    if (existing) {
      throw new Error(`Route already exists for deployment ${config.deploymentId}`);
    }

    // Build public URL based on strategy
    const publicUrl = this.buildPublicUrl(config);

    const route: LocalRoute = {
      routeId: `route_${randomUUID().slice(0, 8)}`,
      deploymentId: config.deploymentId,
      projectId: config.projectId,
      subdomain: config.subdomain,
      targetHost: config.targetHost,
      targetPort: config.targetPort,
      publicUrl,
      status: 'pending',
      tls: config.tls ?? false,
      createdAt: new Date(),
      healthCheckFailures: 0,
    };

    this.registry.add(route);

    // Perform initial health check
    const health = await this.healthChecker.check(route);
    route.status = health.healthy ? 'active' : 'pending';
    route.lastHealthCheck = new Date();
    this.registry.update(route.routeId, route);

    if (this.config.logRoutes) {
      console.log(`[LocalEdgeRouter] Route registered: ${config.subdomain} → ${publicUrl}`);
    }

    return this.toRouteInfo(route);
  }

  /**
   * Update an existing route.
   */
  async updateRoute(routeId: string, config: Partial<RouteConfig>): Promise<RouteInfo> {
    const route = this.registry.get(routeId);
    if (!route) {
      throw new Error(`Route not found: ${routeId}`);
    }

    const updates: Partial<LocalRoute> = {};

    if (config.targetHost !== undefined) updates.targetHost = config.targetHost;
    if (config.targetPort !== undefined) updates.targetPort = config.targetPort;
    if (config.subdomain !== undefined) updates.subdomain = config.subdomain;
    if (config.tls !== undefined) updates.tls = config.tls;

    // Rebuild public URL if target changed
    if (config.targetHost !== undefined || config.targetPort !== undefined || config.subdomain !== undefined) {
      updates.publicUrl = this.buildPublicUrl({
        ...route,
        ...updates,
      } as RouteConfig);
    }

    const updated = this.registry.update(routeId, updates);
    if (!updated) {
      throw new Error(`Failed to update route: ${routeId}`);
    }

    if (this.config.logRoutes) {
      console.log(`[LocalEdgeRouter] Route updated: ${updated.subdomain} → ${updated.publicUrl}`);
    }

    return this.toRouteInfo(updated);
  }

  /**
   * Remove a route.
   */
  async removeRoute(routeId: string): Promise<void> {
    const route = this.registry.get(routeId);
    if (!route) {
      // Idempotent - already removed
      return;
    }

    this.registry.remove(routeId);

    if (this.config.logRoutes) {
      console.log(`[LocalEdgeRouter] Route removed: ${route.subdomain}`);
    }
  }

  /**
   * Get route info for a deployment.
   */
  async getRoute(deploymentId: string): Promise<RouteInfo | null> {
    const route = this.registry.getByDeploymentId(deploymentId);
    return route ? this.toRouteInfo(route) : null;
  }

  /**
   * List all routes for a project.
   */
  async listRoutes(projectId: string): Promise<RouteInfo[]> {
    const routes = this.registry.listByProjectId(projectId);
    return routes.map(r => this.toRouteInfo(r));
  }

  /**
   * Check health of a route.
   */
  async checkRouteHealth(routeId: string): Promise<RouteHealthStatus> {
    const route = this.registry.get(routeId);
    if (!route) {
      return {
        healthy: false,
        error: `Route not found: ${routeId}`,
      };
    }

    const health = await this.healthChecker.check(route);

    // Update route status
    const updates: Partial<LocalRoute> = {
      lastHealthCheck: new Date(),
    };

    if (health.healthy) {
      updates.healthCheckFailures = 0;
      updates.status = 'active';
    } else {
      updates.healthCheckFailures = route.healthCheckFailures + 1;
      if (this.healthChecker.shouldMarkUnhealthy(updates.healthCheckFailures)) {
        updates.status = 'unhealthy';
      }
    }

    this.registry.update(routeId, updates);

    return health;
  }

  /**
   * Start periodic health checking.
   */
  startHealthChecking(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      const routes = this.registry.all();
      await Promise.all(routes.map(route => this.checkRouteHealth(route.routeId)));
    }, this.config.healthCheck.intervalMs);
  }

  /**
   * Stop periodic health checking.
   */
  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get all registered routes.
   */
  getAllRoutes(): RouteInfo[] {
    return this.registry.all().map(r => this.toRouteInfo(r));
  }

  /**
   * Clear all routes.
   */
  clearRoutes(): void {
    this.registry.clear();
    if (this.config.logRoutes) {
      console.log('[LocalEdgeRouter] All routes cleared');
    }
  }

  /**
   * Clean up resources.
   */
  async close(): Promise<void> {
    this.stopHealthChecking();
    this.clearRoutes();
  }

  /**
   * Build public URL based on routing strategy.
   */
  private buildPublicUrl(config: RouteConfig): string {
    const protocol = config.tls ? 'https' : 'http';

    if (this.config.strategy === 'reverse-proxy') {
      // Subdomain-based routing through proxy
      if (this.config.baseDomain === 'localhost') {
        // localhost doesn't support subdomains, use path-based
        return `${protocol}://localhost:${this.config.proxyPort}/${config.subdomain}`;
      }
      return `${protocol}://${config.subdomain}.${this.config.baseDomain}:${this.config.proxyPort}`;
    }

    // Port mapping - direct access to target
    return `${protocol}://${config.targetHost}:${config.targetPort}`;
  }

  /**
   * Convert internal route to RouteInfo.
   */
  private toRouteInfo(route: LocalRoute): RouteInfo {
    return {
      routeId: route.routeId,
      deploymentId: route.deploymentId,
      publicUrl: route.publicUrl,
      status: route.status as RouteStatus,
      createdAt: route.createdAt,
      lastHealthCheck: route.lastHealthCheck,
    };
  }
}
````

### 6. Package Exports (`index.ts`)

```typescript
export { LocalEdgeRouter } from './router';
export { RouteRegistry } from './registry';
export { PortManager } from './port-manager';
export { HealthChecker } from './health-checker';

export type { LocalEdgeRouterConfig, RoutingStrategy, LocalRoute } from './types';

// Re-export core types for convenience
export type { EdgeRouterProvider, RouteConfig, RouteInfo, RouteHealthStatus, RouteStatus } from '@mastra/admin';
```

## Package Configuration

### package.json

```json
{
  "name": "@mastra/router-local",
  "version": "1.0.0",
  "description": "Local edge router for MastraAdmin development environments",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "CHANGELOG.md"],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:docs": "pnpx tsx ../../scripts/generate-package-docs.ts routers/local",
    "build:watch": "pnpm build:lib --watch",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.build.json"
  },
  "license": "Apache-2.0",
  "dependencies": {},
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@types/node": "22.13.17",
    "@vitest/coverage-v8": "catalog:",
    "@vitest/ui": "catalog:",
    "eslint": "^9.37.0",
    "tsup": "^8.5.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "peerDependencies": {
    "@mastra/admin": ">=1.0.0-0 <2.0.0-0"
  },
  "optionalDependencies": {
    "http-proxy": "^1.18.1"
  },
  "homepage": "https://mastra.ai",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mastra-ai/mastra.git",
    "directory": "routers/local"
  },
  "bugs": {
    "url": "https://github.com/mastra-ai/mastra/issues"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

## Implementation Tasks

### Phase 1: Core Implementation

- [ ] **Task 1.1**: Create package directory structure and configuration files
  - Create `routers/local/` directory
  - Set up `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
  - Add to workspace in root `pnpm-workspace.yaml`
  - Add to `turbo.json` build pipeline

- [ ] **Task 1.2**: Implement types and configuration (`types.ts`)
  - Define `LocalEdgeRouterConfig` interface
  - Define `RoutingStrategy` type
  - Define `LocalRoute` internal type

- [ ] **Task 1.3**: Implement RouteRegistry (`registry.ts`)
  - In-memory route storage with maps
  - Index by routeId, deploymentId, projectId
  - CRUD operations with proper cleanup

- [ ] **Task 1.4**: Implement PortManager (`port-manager.ts`)
  - Port availability checking
  - Port allocation from range
  - Port release and tracking

- [ ] **Task 1.5**: Implement HealthChecker (`health-checker.ts`)
  - HTTP GET health checks
  - Timeout handling
  - Failure counting and threshold logic

- [ ] **Task 1.6**: Implement LocalEdgeRouter (`router.ts`)
  - Implement all `EdgeRouterProvider` interface methods
  - Public URL building for port-mapping strategy
  - Route lifecycle management
  - Health check integration
  - Console logging of routes

- [ ] **Task 1.7**: Create package exports (`index.ts`)
  - Export all public classes and types
  - Re-export relevant types from `@mastra/admin`

### Phase 2: Testing

- [ ] **Task 2.1**: Unit tests for RouteRegistry
  - Add/get/update/remove operations
  - Index lookups by deploymentId and projectId
  - Edge cases (duplicate adds, missing routes)

- [ ] **Task 2.2**: Unit tests for PortManager
  - Port allocation within range
  - Port availability checking
  - Port exhaustion handling

- [ ] **Task 2.3**: Unit tests for HealthChecker
  - Successful health checks
  - Failed health checks
  - Timeout handling
  - Failure threshold logic

- [ ] **Task 2.4**: Integration tests for LocalEdgeRouter
  - Full route lifecycle (register → update → remove)
  - Health checking workflow
  - Multiple routes per project
  - Error handling

### Phase 3: Optional Features (Future)

These features can be implemented as needed:

- [ ] **Task 3.1**: Reverse Proxy Support
  - Implement `ProxyServer` using `http-proxy`
  - Subdomain-based routing (for custom domains)
  - Path-based routing (for localhost)
  - WebSocket proxy support

- [ ] **Task 3.2**: Hosts File Management
  - Read/write `/etc/hosts` (Linux/macOS)
  - Windows hosts file support
  - Add/remove custom domain entries
  - Backup and restore on error

- [ ] **Task 3.3**: Local TLS Support
  - Self-signed certificate generation
  - Certificate storage and caching
  - Trust store integration hints

## Usage Examples

### Basic Usage

```typescript
import { LocalEdgeRouter } from '@mastra/router-local';

const router = new LocalEdgeRouter({
  baseDomain: 'localhost',
  portRange: { start: 3100, end: 3199 },
  logRoutes: true,
});

// Register a route
const route = await router.registerRoute({
  deploymentId: 'deploy-123',
  projectId: 'project-456',
  subdomain: 'job-matcher',
  targetHost: 'localhost',
  targetPort: 3001,
});

console.log(`Server available at: ${route.publicUrl}`);
// Output: Server available at: http://localhost:3001

// Check health
const health = await router.checkRouteHealth(route.routeId);
if (!health.healthy) {
  console.error('Route unhealthy:', health.error);
}

// List routes for a project
const projectRoutes = await router.listRoutes('project-456');

// Clean up
await router.removeRoute(route.routeId);
```

### With MastraAdmin

```typescript
import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalProcessRunner } from '@mastra/runner-local';

const admin = new MastraAdmin({
  licenseKey: process.env.MASTRA_LICENSE_KEY!,
  storage: new PostgresAdminStorage({ connectionString: process.env.DATABASE_URL! }),
  runner: new LocalProcessRunner({ workDir: '/tmp/mastra-builds' }),
  router: new LocalEdgeRouter({
    portRange: { start: 3100, end: 3199 },
    healthCheck: { intervalMs: 10000 },
  }),
});

await admin.init();

// Deploy will automatically register routes
const build = await admin.deploy('user-123', 'deployment-456');
```

## Success Criteria

1. **Interface Compliance**: Fully implements `EdgeRouterProvider` interface
2. **Route Management**: Register, update, remove, get, and list routes work correctly
3. **Health Checking**: HTTP health checks with proper failure tracking
4. **Port Mapping**: Generates correct public URLs for local development
5. **Logging**: Console output shows route changes for debugging
6. **Tests**: >80% code coverage with unit and integration tests
7. **Documentation**: Clear usage examples and API documentation

## Dependencies

| Package         | Purpose                             | Required      |
| --------------- | ----------------------------------- | ------------- |
| `@mastra/admin` | EdgeRouterProvider interface, types | Yes (peer)    |
| `http-proxy`    | Reverse proxy server                | No (optional) |

## Notes

- The local router is designed for development; production should use `@mastra/router-cloudflare`
- Port mapping strategy is simplest and recommended for most local development
- Reverse proxy strategy is optional and useful when you need subdomain-based routing
- Hosts file management requires elevated permissions and is disabled by default
- Health checks run periodically when `startHealthChecking()` is called
