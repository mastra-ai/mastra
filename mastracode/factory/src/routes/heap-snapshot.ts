/**
 * Admin-gated, on-demand v8 heap snapshot download.
 *
 * `GET /web/admin/heap-snapshot` streams `v8.getHeapSnapshot()` straight back
 * as the response body so a maintainer can pull a `.heapsnapshot` from a live
 * Factory process without shell access (Railway deployments have no exec).
 *
 * Trust boundary: the response is the whole process heap. It carries every
 * in-process secret — user-scoped model credentials the credential model
 * otherwise withholds from organization admins, integration tokens, and the
 * data of every other organization the process serves. Enabling the flag is
 * only safe on a single-tenant deployment the operator controls.
 *
 * Cost: snapshotting blocks the event loop for the whole serialization (tens
 * of seconds on a multi-GB heap) and needs roughly heap-size extra memory, so
 * near the heap limit it can OOM the process.
 *
 * It is off by default and gated twice:
 *
 *   1. the `FACTORY_HEAP_SNAPSHOT` env flag must be `1` or `true`
 *      (case-insensitive); otherwise the route answers with the app's normal
 *      not-found response;
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
  /** Clock seam for the filename timestamp; defaults to `Date.now()`. */
  now?: () => Date;
  /** Snapshot producer seam; defaults to `v8.getHeapSnapshot()`. */
  getHeapSnapshot?: () => NodeJS.ReadableStream;
  /** Logger seam; defaults to `console`. */
  logger?: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

function heapSnapshotEnabled(): boolean {
  const raw = process.env.FACTORY_HEAP_SNAPSHOT?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

/** Filename-safe ISO timestamp: `2026-11-18T15-30-00.000Z`. */
function filenameTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}

export class HeapSnapshotRoutes extends Route<HeapSnapshotRoutesDeps> {
  /**
   * Single-flight guard. Running two snapshots at once is a fast way to OOM a
   * saturated process.
   */
  #inFlight = false;

  /**
   * Fail-closed scope check, mirroring {@link AutomationRunRoutes.#resolveScope}.
   * Returns `null` when the caller is allowed through, otherwise the error response.
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
    const now = this.deps.now ?? (() => new Date());
    const getHeapSnapshot = this.deps.getHeapSnapshot ?? (() => v8.getHeapSnapshot());
    const logger = this.deps.logger ?? console;

    return [
      registerApiRoute('/web/admin/heap-snapshot', {
        method: 'GET',
        handler: async c => {
          const context = loose(c);
          if (!heapSnapshotEnabled()) return context.notFound();

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

          // The file is JSON, but the browser must save it rather than render
          // it, and nothing between here and the caller may keep a copy.
          context.header('Content-Type', 'application/octet-stream');
          context.header('Content-Disposition', `attachment; filename="${filename}"`);
          context.header('Cache-Control', 'no-store');

          let failed = false;
          return stream(
            context,
            async honoStream => {
              try {
                const snapshot = getHeapSnapshot();
                const readable = snapshot instanceof Readable ? snapshot : Readable.from(snapshot);
                for await (const chunk of readable) {
                  await honoStream.write(chunk as Uint8Array);
                }
              } catch (error) {
                failed = true;
                throw error;
              } finally {
                this.#inFlight = false;
                logger.info('heap snapshot finished', {
                  filename,
                  outcome: failed ? 'error' : 'ok',
                  durationMs: Date.now() - startedAt,
                  heapUsedBytes: heapUsedBefore,
                  heapUsedBytesAfter: process.memoryUsage().heapUsed,
                });
              }
            },
            async (error, honoStream) => {
              logger.error('heap snapshot failed', { filename, error: String(error) });
              await honoStream.close();
            },
          );
        },
      }),
    ];
  }
}

export function buildHeapSnapshotRoutes(deps: HeapSnapshotRoutesDeps): ApiRoute[] {
  return new HeapSnapshotRoutes(deps).routes();
}
