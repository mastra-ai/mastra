import type { RequestContext } from '../../request-context';

/**
 * Request-context key holding the total-timeout deadline of runs that have no
 * execution claim (Inngest), keyed by runId. It travels in the serialized
 * request context of every trigger and resume event, so a step on any worker
 * can tell the run is past its deadline without the driver's registry entry.
 */
export const MASTRA_DURABLE_DEADLINES_KEY = 'mastra__durableDeadlines';

/**
 * A run's deadline. `fence` is the memory run fence raised for this execution
 * session when the memory store supports fencing: memory writes made inside a
 * deadline scope carry it, and expiring the deadline raises a newer one, so a
 * write that passed every check before the deadline is still rejected by the
 * store if it lands after it.
 */
export interface DurableRunDeadline {
  expiresAt: number;
  fence?: { generation: number; ownerId: string };
}

type DeadlineEntries = Record<string, DurableRunDeadline>;

function readDeadlines(value: unknown): DeadlineEntries | undefined {
  return value && typeof value === 'object' ? (value as DeadlineEntries) : undefined;
}

/** The deadline recorded for `runId` in a live request context or serialized entries. */
export function getRunDeadline(
  context: RequestContext | Record<string, unknown> | undefined,
  runId: string,
): DurableRunDeadline | undefined {
  if (!context) return undefined;
  const value =
    typeof (context as RequestContext).getRaw === 'function'
      ? (context as RequestContext).getRaw(MASTRA_DURABLE_DEADLINES_KEY)
      : (context as Record<string, unknown>)[MASTRA_DURABLE_DEADLINES_KEY];
  const deadline = readDeadlines(value)?.[runId];
  return typeof deadline?.expiresAt === 'number' ? deadline : undefined;
}

/**
 * Return serialized request-context entries with `runId`'s deadline set, or
 * removed when `deadline` is undefined. Never mutates `entries`.
 */
export function withRunDeadline(
  entries: Record<string, unknown> | undefined,
  runId: string,
  deadline: DurableRunDeadline | undefined,
): Record<string, unknown> {
  const { [MASTRA_DURABLE_DEADLINES_KEY]: current, ...rest } = entries ?? {};
  const { [runId]: _previous, ...others } = readDeadlines(current) ?? {};
  const deadlines: DeadlineEntries = deadline ? { ...others, [runId]: deadline } : others;
  return Object.keys(deadlines).length ? { ...rest, [MASTRA_DURABLE_DEADLINES_KEY]: deadlines } : rest;
}

/** Whether `runId` carries a deadline that has passed. */
export function isRunPastDeadline(requestContext: RequestContext | undefined, runId: string): boolean {
  const deadline = getRunDeadline(requestContext, runId);
  return deadline !== undefined && Date.now() >= deadline.expiresAt;
}
