import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';

import type { DashboardPrincipal } from '../auth/dashboard-principal.js';
import type { AppEnv } from '../../http-context.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { DomainError } from '../../domain/errors.js';
import { dashboardIncidentExists, dashboardLastTimelineSequence, listDashboardTimeline } from './queries.js';

export function parseLastEventId(incidentId: string, value: string | undefined): number | null {
  if (!value) return 0;
  const match = new RegExp(`^${escapeRegExp(incidentId)}:([1-9][0-9]*)$`, 'u').exec(value);
  if (!match?.[1]) return null;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export async function validateSseReplay(
  store: OperationalStore,
  principal: DashboardPrincipal,
  incidentId: string,
  lastEventId: string | undefined,
) {
  const after = parseLastEventId(incidentId, lastEventId);
  if (after === null) return null;
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(incidentId) ||
    !(await dashboardIncidentExists(store, {
      tenantId: principal.tenantId,
      incidentId,
    }))
  )
    throw new DomainError('NOT_FOUND');
  const events = await listDashboardTimeline(store, { tenantId: principal.tenantId, incidentId }, after, 201);
  const lastKnown = await dashboardLastTimelineSequence(store, {
    tenantId: principal.tenantId,
    incidentId,
  });
  if (events.length > 200 || after > lastKnown || (after > 0 && events.length > 0 && events[0]?.sequence !== after + 1))
    return null;
  return { after, events };
}

export function sseResponse(
  context: Context<AppEnv>,
  input: Readonly<{
    store: OperationalStore;
    principal: DashboardPrincipal;
    incidentId: string;
    replay: readonly Awaited<ReturnType<typeof listDashboardTimeline>>[number][];
    after: number;
    release: () => void;
  }>,
) {
  return streamSSE(context, async stream => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      input.release();
    };
    stream.onAbort(release);
    let sequence = input.replay.at(-1)?.sequence ?? input.after;
    try {
      for (const event of input.replay) await writeEvent(stream, event);
    } catch (error) {
      release();
      throw error;
    }
    let closed = false;
    let polling = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearInterval(poll);
      clearTimeout(maximum);
      release();
    };
    const closeWithResync = async () => {
      if (closed) return;
      try {
        await stream.writeSSE({
          event: 'resync',
          data: JSON.stringify({ code: 'RESYNC_REQUIRED' }),
        });
      } catch {
        // A failed transport must not prevent quota/timer release.
      } finally {
        cleanup();
        await stream.close().catch(() => undefined);
      }
    };
    const heartbeat = setInterval(() => {
      if (!closed) void stream.writeSSE({ event: 'heartbeat', data: '{}' }).catch(closeWithResync);
    }, 15_000);
    const poll = setInterval(() => {
      if (closed || polling) return;
      polling = true;
      void listDashboardTimeline(
        input.store,
        { tenantId: input.principal.tenantId, incidentId: input.incidentId },
        sequence,
        201,
      )
        .then(async events => {
          if (events.length > 200 || (events.length > 0 && events[0]?.sequence !== sequence + 1))
            throw new Error('SSE gap');
          for (const event of events) {
            sequence = event.sequence;
            await writeEvent(stream, event);
          }
        })
        .catch(async () => {
          await closeWithResync();
        })
        .finally(() => {
          polling = false;
        });
    }, 1_000);
    const maximum = setTimeout(() => {
      void closeWithResync();
    }, 900_000);
    stream.onAbort(cleanup);
    await new Promise<void>(resolve => stream.onAbort(resolve));
  });
}

/**
 * EventSource hides non-2xx response bodies. For its explicit browser
 * transport we therefore deliver the protocol's RESYNC_REQUIRED signal as a
 * valid, immediately closed SSE response. API callers without that opt-in
 * keep the regular 409 envelope from the route.
 */
export function sseResyncResponse(context: Context<AppEnv>) {
  return streamSSE(context, async stream => {
    try {
      await stream.writeSSE({
        event: 'resync',
        data: JSON.stringify({ code: 'RESYNC_REQUIRED' }),
      });
    } finally {
      await stream.close().catch(() => undefined);
    }
  });
}

async function writeEvent(
  stream: Parameters<typeof streamSSE>[1] extends (stream: infer T) => unknown ? T : never,
  event: Awaited<ReturnType<typeof listDashboardTimeline>>[number],
) {
  await stream.writeSSE({
    id: `${event.incidentId}:${event.sequence}`,
    data: JSON.stringify(event),
  });
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
