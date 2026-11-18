/**
 * Admin-gated, on-demand v8 heap snapshot download.
 *
 * `GET /web/admin/heap-snapshot` streams `v8.getHeapSnapshot()` straight back
 * as the response body so a maintainer can pull a `.heapsnapshot` from a live
 * Factory process without shell access (Railway deployments have no exec).
 *
 * This is a diagnostic tool, not a steady-state endpoint: see the WARNINGS in
 * the handler. It is off by default and gated twice —
 *
 *   1. the `FACTORY_HEAP_SNAPSHOT` env flag must be `1`/`true` (case-insensitive);
 *      with the flag absent or anything else the route 404s before any auth
 *      check, so an unconfigured deployment exposes no snapshot capability;
 *   2. tenant-mode callers must administer the organization, following the
 *      same `isOrganizationAdmin` check used by {@link AutomationRunRoutes}
 *      in `./automation-runs.ts`. Local (no-auth) deployments only require
 *      the env flag, mirroring the convention there.
 *
 * Only one snapshot runs at a time per process: a second concurrent request
 * returns 409 instead of fighting for CPU and heap with the one already in
 * flight.
 */

import { Readable } from 'node:stream';
import * as v8 from 'node:v8';

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import { loose, Route } from './route.js';
import type { RouteDependencies } from './route.js';

export interface HeapSnapshotRoutesDeps extends RouteDependencies {
  /** Whether the endpoint is enabled; defaults to reading `FACTORY_HEAP_SNAPSHOT`. */
  isEnabled?: () => boolean;
  /** Clock seam for the filename timestamp; defaults to `Date.now()`. */
  now?: () => Date;
  /** Snapshot producer seam; defaults to `v8.getHeapSnapshot()`. */
  getHeapSnapshot?: () => NodeJS.ReadableStream;
  /** Logger seam; defaults to `console`. */
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
}

/** Parse a boolean-ish env var the same way the rest of Factory does. */
function envEnabled(): boolean {
  const raw = process.env.FACTORY_HEAP_SNAPSHOT;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/** Filename-safe ISO timestamp: `2026-11-18T15-30-00-000Z`. */
function filenameTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}

export class HeapSnapshotRoutes extends Route<HeapSnapshotRoutesDeps> {
  /**
   * Single-flight guard. Snapshotting a multi-GB heap can take tens of
   * seconds and roughly doubles RSS momentarily; running two at once is a
   * fast way to OOM a saturated process.
   */
  #inFlight = false;

  /**
   * Fail-closed scope check, mirroring {@link AutomationRunRoutes.#resolveScope}.
   *
   * Returns `null` when the caller is allowed through, or a `Response` with
   * the appropriate status when not.
   */
  async #checkAccess(c: Context): Promise<Response | null> {
    const { auth } = this.deps;
    if (!auth.enabled()) return null;

    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) return c.json({ error: 'unauthorized' }, 401);
    if (!tenant.orgId) {
      return c.json(
        { error: 'organization_required', message: 'The Factory heap snapshot endpoint requires an organization.' },
        403,
      );
    }
    if (!(await auth.isOrganizationAdmin(c, tenant.orgId))) {
      return c.json(
        { error: 'forbidden', message: 'Organization administrator access is required for heap snapshots.' },
        403,
      );
    }
    return null;
  }

  routes(): ApiRoute[] {
    const isEnabled = this.deps.isEnabled ?? envEnabled;
    const now = this.deps.now ?? (() => new Date());
    const getHeapSnapshot = this.deps.getHeapSnapshot ?? (() => v8.getHeapSnapshot());
    const logger = this.deps.logger ?? console;

    return [
      registerApiRoute('/web/admin/heap-snapshot', {
        method: 'GET',
        handler: async c => {
          const context = loose(c);
          if (!isEnabled()) return context.json({ error: 'not_found' }, 404);

          const denied = await this.#checkAccess(context);
          if (denied) return denied;

          if (this.#inFlight) {
            return context.json(
              { error: 'conflict', message: 'A heap snapshot is already in progress on this process.' },
              409,
            );
          }

          this.#inFlight = true;
          const startedAt = Date.now();
          const heapUsedBefore = process.memoryUsage().heapUsed;
          const filename = `factory-${filenameTimestamp(now())}.heapsnapshot`;
          logger.info('heap snapshot starting', { filename, heapUsedBytes: heapUsedBefore });

          // Content-Type application/octet-stream — the file is JSON, but the
          // browser must save-as, not render. The filename steers Chrome
          // DevTools "Load profile" straight to the right memory tool.
          context.header('Content-Type', 'application/octet-stream');
          context.header('Content-Disposition', `attachment; filename="${filename}"`);

          return stream(context, async honoStream => {
            try {
              const snapshot = getHeapSnapshot();
              const nodeReadable = snapshot instanceof Readable ? snapshot : Readable.from(snapshot);
              for await (const chunk of nodeReadable) {
                await honoStream.write(chunk as Uint8Array);
              }
            } finally {
              this.#inFlight = false;
              const heapUsedAfter = process.memoryUsage().heapUsed;
              logger.info('heap snapshot finished', {
                filename,
                durationMs: Date.now() - startedAt,
                heapUsedBytes: heapUsedBefore,
                heapUsedBytesAfter: heapUsedAfter,
              });
            }
          });
        },
      }),
    ];
  }
}

export function buildHeapSnapshotRoutes(deps: HeapSnapshotRoutesDeps): ApiRoute[] {
  return new HeapSnapshotRoutes(deps).routes();
}
