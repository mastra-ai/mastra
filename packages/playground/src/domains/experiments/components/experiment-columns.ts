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
  succeeded: 'Succeeded',
  failed: 'Failed',
  review: 'Review',
  date: 'Date',
};

export function formatExperimentDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
