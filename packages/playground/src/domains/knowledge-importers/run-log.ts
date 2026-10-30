import type { KnowledgeImporterRunEvent } from '@mastra/client-js';

export type RunLogFilter = 'all' | 'warnings' | 'errors';

const SHOWN_LEVELS: Record<RunLogFilter, ReadonlySet<KnowledgeImporterRunEvent['level']>> = {
  all: new Set(['info', 'warn', 'error']),
  warnings: new Set(['warn', 'error']),
  errors: new Set(['error']),
};

/** A log line, or the one line that stands in for every provider request of a source. */
export type RunLogRow =
  | { kind: 'event'; key: string; event: KnowledgeImporterRunEvent }
  | { kind: 'requests'; key: string; at: string; message: string };

const providerOf = (event: KnowledgeImporterRunEvent) => {
  const provider = event.data?.provider;
  return typeof provider === 'string' ? provider : 'the source';
};

/**
 * The rows to show. Request lines (`debug`) are plumbing: unless the reader asks for them they
 * collapse into one line per source, at the first request, whose count grows as the run goes.
 */
export function buildRunLogRows(
  events: KnowledgeImporterRunEvent[],
  filter: RunLogFilter,
  { showRequests, done }: { showRequests: boolean; done: boolean },
): RunLogRow[] {
  const rows: RunLogRow[] = [];
  const requests = new Map<string, { at: string; count: number; index: number }>();
  for (const event of events) {
    if (event.level !== 'debug') {
      if (SHOWN_LEVELS[filter].has(event.level)) rows.push({ kind: 'event', key: String(event.seq), event });
      continue;
    }
    if (filter !== 'all') continue;
    if (showRequests) {
      rows.push({ kind: 'event', key: String(event.seq), event });
      continue;
    }
    const provider = providerOf(event);
    const seen = requests.get(provider);
    if (seen) {
      seen.count += 1;
      continue;
    }
    requests.set(provider, { at: event.at, count: 1, index: rows.length });
    rows.push({ kind: 'requests', key: `requests:${provider}`, at: event.at, message: '' });
  }
  for (const [provider, { at, count, index }] of requests) {
    const noun = count === 1 ? 'request' : 'requests';
    rows[index] = {
      kind: 'requests',
      key: `requests:${provider}`,
      at,
      message: `${done ? 'Fetched' : 'Fetching'} from ${provider}: ${count} ${noun}`,
    };
  }
  return rows;
}

export const hasRequestLines = (events: KnowledgeImporterRunEvent[]) => events.some(event => event.level === 'debug');

export const EMPTY_FILTER_COPY: Record<RunLogFilter, string> = {
  all: 'Waiting for the first event…',
  warnings: 'No warnings or errors so far.',
  errors: 'No errors so far.',
};

/** Time since the run started, as `+4.2s` or `+2m 05s`. */
export function describeElapsed(origin: string | undefined, at: string): string {
  const ms = origin ? new Date(at).getTime() - new Date(origin).getTime() : 0;
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (safe < 60_000) return `+${(safe / 1000).toFixed(1)}s`;
  const seconds = Math.floor(safe / 1000);
  return `+${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}
