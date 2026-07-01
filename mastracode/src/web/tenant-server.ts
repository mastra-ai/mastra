/**
 * Per-tenant Mastra controller dispatch for the multi-tenant web server.
 *
 * When web auth is enabled, every authenticated WorkOS user must operate against
 * their OWN Mastra instance bound to their OWN isolated libSQL storage/vector
 * pair (see `tenant-storage.ts`). A single shared Mastra/controller would land
 * all tenants' threads, messages, memory and recall vectors in one store — a
 * hard privacy violation.
 *
 * The Hono adapter binds a single fixed `Mastra` into request context at
 * construction time (`c.set('mastra', this.mastra)`), so outer middleware can't
 * retarget a shared controller per request. Instead, each tenant gets its own
 * fully isolated `MastraServer` adapter (its own Hono sub-app + Mastra +
 * storage). This dispatcher lazily builds and caches one per WorkOS user and
 * forwards `/api/*` requests to the right tenant app.
 *
 * Auth-disabled / local-dev keeps using the single shared adapter built by the
 * caller — this module is only engaged when `webAuthUser` is present.
 */

import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { Hono } from 'hono';
import type { Context } from 'hono';

import { mountAgentControllerOnMastra } from '../index.js';
import type { MastraCodeConfig } from '../index.js';

import { webAuthTenant } from './auth.js';
import { getUserStorage } from './tenant-storage.js';
import type { TenantIdentity } from './tenant-storage.js';

/** A fully isolated per-tenant controller stack. */
interface TenantApp {
  /** The tenant's Hono app with the Mastra surface mounted under `/api`. */
  fetch: (request: Request, ...rest: unknown[]) => Response | Promise<Response>;
  /** Stop the tenant's workers/heartbeats on eviction or shutdown. */
  stop: () => Promise<void>;
}

/**
 * Builds a fully isolated tenant app for a given storage config. Injectable so
 * tests can exercise eviction/LRU behavior without booting a real Mastra stack.
 */
export type TenantAppBuilder = (
  storage: MastraCodeConfig['storage'],
  ctx: { baseConfig: MastraCodeConfig; controllerId: string },
) => Promise<TenantApp>;

export interface TenantDispatcherOptions {
  /** Base controller config shared by every tenant (minus storage). */
  baseConfig: MastraCodeConfig;
  /** Controller id, matching the shared controller. */
  controllerId: string;
  /**
   * Tenant app builder. Defaults to the real Mastra-backed builder; injected in
   * tests to avoid booting a real Mastra stack.
   */
  buildTenantApp?: TenantAppBuilder;
  /**
   * Evict tenant apps idle for longer than this. Defaults to
   * `MASTRACODE_TENANT_IDLE_MINUTES` (minutes) or 30 minutes. 0 disables
   * idle-based eviction.
   */
  idleMs?: number;
  /**
   * Cap on cached tenant apps. When exceeded, the least-recently-used app is
   * evicted. Defaults to `MASTRACODE_TENANT_MAX_APPS` or 100. 0 disables the cap.
   */
  maxApps?: number;
  /** Clock injection for deterministic eviction tests. Defaults to `Date.now`. */
  now?: () => number;
}

/** Default real Mastra-backed tenant app builder. */
const defaultBuildTenantApp: TenantAppBuilder = async (storage, { baseConfig, controllerId }) => {
  const result = await mountAgentControllerOnMastra({
    ...baseConfig,
    storage,
    controllerId,
  });

  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
  const adapter = new MastraServer({ app, mastra: result.mastra });
  await adapter.init();

  return {
    fetch: (request, ...rest) => app.fetch(request as Request, ...(rest as [])),
    stop: async () => {
      await Promise.allSettled([result.controller.getMastra()?.stopWorkers(), result.controller.stopIntervals()]);
    },
  };
};

function resolveIdleMs(option: number | undefined): number {
  if (option !== undefined) return option;
  const raw = process.env.MASTRACODE_TENANT_IDLE_MINUTES;
  const minutes = raw ? Number(raw) : NaN;
  if (Number.isFinite(minutes) && minutes >= 0) return minutes * 60_000;
  return 30 * 60_000;
}

function resolveMaxApps(option: number | undefined): number {
  if (option !== undefined) return option;
  const raw = process.env.MASTRACODE_TENANT_MAX_APPS;
  const max = raw ? Number(raw) : NaN;
  if (Number.isFinite(max) && max >= 0) return max;
  return 100;
}

/** Cache entry tracking the built app plus its last-used timestamp. */
interface CacheEntry {
  app: Promise<TenantApp>;
  lastUsed: number;
}

/**
 * Builds and caches per-tenant Mastra controller stacks and dispatches requests
 * to them based on the authenticated WorkOS user.
 *
 * The cache is bounded: apps idle past `idleMs` are swept and evicted (their
 * workers stopped), and an LRU `maxApps` cap prevents unbounded growth as a team
 * grows. Evicted tenants are lazily rebuilt on their next request.
 */
export class TenantDispatcher {
  private readonly baseConfig: MastraCodeConfig;
  private readonly controllerId: string;
  private readonly build: TenantAppBuilder;
  private readonly idleMs: number;
  private readonly maxApps: number;
  private readonly now: () => number;
  /** tenantKey -> cache entry (in-flight or resolved tenant app + lastUsed). */
  private readonly apps = new Map<string, CacheEntry>();

  constructor(options: TenantDispatcherOptions) {
    this.baseConfig = options.baseConfig;
    this.controllerId = options.controllerId;
    this.build = options.buildTenantApp ?? defaultBuildTenantApp;
    this.idleMs = resolveIdleMs(options.idleMs);
    this.maxApps = resolveMaxApps(options.maxApps);
    this.now = options.now ?? Date.now;
  }

  /** Get-or-create the tenant app for an `(org, user)` identity. */
  private async getTenantApp(identity: TenantIdentity): Promise<TenantApp> {
    this.sweepIdle();
    const { tenantKey, storageConfig } = await getUserStorage(identity);
    const existing = this.apps.get(tenantKey);
    if (existing) {
      existing.lastUsed = this.now();
      return existing.app;
    }

    const built = this.build(storageConfig, {
      baseConfig: this.baseConfig,
      controllerId: this.controllerId,
    }).catch(err => {
      // Don't cache failures — let the next request retry a clean build.
      this.apps.delete(tenantKey);
      throw err;
    });
    this.apps.set(tenantKey, { app: built, lastUsed: this.now() });
    this.enforceMaxApps();
    return built;
  }

  /** Evict any tenant apps idle for longer than `idleMs`. */
  private sweepIdle(): void {
    if (this.idleMs <= 0) return;
    const cutoff = this.now() - this.idleMs;
    for (const [key, entry] of [...this.apps.entries()]) {
      if (entry.lastUsed <= cutoff) {
        this.evict(key, entry);
      }
    }
  }

  /** Evict the least-recently-used apps until within `maxApps`. */
  private enforceMaxApps(): void {
    if (this.maxApps <= 0) return;
    while (this.apps.size > this.maxApps) {
      let lruKey: string | undefined;
      let lruEntry: CacheEntry | undefined;
      for (const [key, entry] of this.apps) {
        if (!lruEntry || entry.lastUsed < lruEntry.lastUsed) {
          lruKey = key;
          lruEntry = entry;
        }
      }
      if (!lruKey || !lruEntry) break;
      this.evict(lruKey, lruEntry);
    }
  }

  /** Remove an entry from the cache and stop its workers (fire-and-forget). */
  private evict(key: string, entry: CacheEntry): void {
    this.apps.delete(key);
    // Both the build (`entry.app`) and the subsequent `stop()` can reject;
    // swallow either so eviction never produces an unhandled rejection.
    void entry.app.then(app => app.stop()).catch(() => undefined);
  }

  /**
   * Hono middleware: when an authenticated user is present, forward the request
   * to that user's isolated Mastra app and return its response. When no user is
   * present (auth disabled), fall through to the shared adapter via `next()`.
   */
  middleware() {
    return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
      // Custom web-only routes (`/api/web/...`: config, fs, GitHub) live on the
      // outer app and use the app DB + webAuthUser, not tenant Mastra storage.
      // They must NOT be forwarded to the tenant app (which has no such routes).
      if (c.req.path.startsWith('/api/web/')) {
        return next();
      }
      const identity = webAuthTenant(c);
      if (!identity) {
        // Auth disabled or unauthenticated public route — use the shared path.
        return next();
      }
      const tenant = await this.getTenantApp(identity);
      return tenant.fetch(c.req.raw);
    };
  }

  /** Tear down all cached tenant stacks (server shutdown). */
  async stopAll(): Promise<void> {
    const entries = [...this.apps.values()];
    this.apps.clear();
    await Promise.allSettled(
      entries.map(async entry => {
        try {
          const app = await entry.app;
          await app.stop();
        } catch {
          // ignore — already failed to build
        }
      }),
    );
  }

  /** For tests: number of currently cached tenant apps. */
  size(): number {
    return this.apps.size;
  }
}
