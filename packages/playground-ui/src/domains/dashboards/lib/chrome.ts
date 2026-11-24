import type { ChartCardProps } from '../../metrics/components/chart-card';

/**
 * What a widget's card shows in its top bar: `title`, plus its actions: the drilldown, the alert,
 * the expand link, then the host's. Several views are tabs in its `toolbar`, under the title.
 */
export type ViewHeading = Pick<ChartCardProps, 'title' | 'dragHandle' | 'onTitleChange' | 'actions' | 'toolbar'>;

/** Filters a gate can't apply, named as the filter bar names them. */
const FILTER_NAMES: Record<string, string> = {
  serviceName: 'service',
  requestId: 'request ID',
  experimentId: 'experiment',
};

export const unsupportedMessage = (fields: string[], names: Record<string, string> = FILTER_NAMES) =>
  `Not available with a ${fields.map(f => names[f] ?? f).join(' or ')} filter.`;

/** A view's value in the widget's state: its label in kebab case (`Token usage` → `token-usage`), or its position when unlabelled or blank. */
export const viewValue = (label: string | undefined, index: number) => {
  const trimmed = label?.trim();
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, '-') : String(index);
};

/** A view's visible name: its label, or `View n` when unlabelled or blank, so every option has an accessible name. */
export const viewLabel = (label: string | undefined, index: number) => label?.trim() || `View ${index + 1}`;
