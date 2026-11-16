import { useTracesColumns } from './traces-explorer-context';
import { ObservabilitySavedViews } from '@/domains/observability/saved-views';
import type { ObservabilitySavedViewsProps } from '@/domains/observability/saved-views';

export type TracesExplorerSavedViewsProps = Pick<
  ObservabilitySavedViewsProps,
  'searchParams' | 'setSearchParams' | 'className'
>;

/**
 * Saved views of the traces page, with the explorer's columns. Takes the host's search params, which
 * the host also maps to the explorer's filters. Renders nothing without a `SavedViewsProvider`.
 */
export function TracesExplorerSavedViews(props: TracesExplorerSavedViewsProps) {
  const columns = useTracesColumns();
  return <ObservabilitySavedViews page="traces" columns={columns} {...props} />;
}
