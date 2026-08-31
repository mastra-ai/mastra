import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';

// experiment name is free-form — an `auto` track would let it starve its neighbours
export const EXPERIMENT_NAME_COLUMN = 'minmax(9rem,1fr)';
export const EXPERIMENT_DATASET_COLUMN = '1fr';
export const EXPERIMENT_DETAIL_COLUMNS = 'auto auto auto auto auto auto auto';

export const experimentColumnLabels = {
  experiment: 'Experiment',
  dataset: 'Dataset',
  target: 'Target',
  status: 'Status',
  items: 'Items',
  succeeded: 'Processed',
  failed: 'Errored',
  review: 'Review',
  date: 'Date',
};

// A completed run is neutral, not a success: it says the run finished, not that the scores are good.
export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  completed: 'neutral',
  running: 'yellow',
  failed: 'red',
  pending: 'neutral',
};

// "Completed" alone reads as a verdict on the scores; "Run completed" says it's the run that finished.
export const STATUS_LABEL: Record<string, string> = {
  completed: 'Run completed',
  running: 'Run in progress',
  failed: 'Run failed',
  pending: 'Run queued',
};

export function formatExperimentDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
