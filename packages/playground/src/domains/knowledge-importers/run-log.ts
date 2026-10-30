import type { KnowledgeImporterRunEvent } from '@mastra/client-js';

export type RunLogFilter = 'all' | 'warnings' | 'errors';

const SHOWN_LEVELS: Record<RunLogFilter, ReadonlySet<KnowledgeImporterRunEvent['level']>> = {
  all: new Set(['info', 'warn', 'error']),
  warnings: new Set(['warn', 'error']),
  errors: new Set(['error']),
};

export const filterRunEvents = (events: KnowledgeImporterRunEvent[], filter: RunLogFilter) =>
  filter === 'all' ? events : events.filter(event => SHOWN_LEVELS[filter].has(event.level));

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
