import { ObservabilitySavedViews } from '@/domains/observability/saved-views';
import type { ObservabilitySavedViewsProps } from '@/domains/observability/saved-views';

export type LogsSavedViewsProps = Pick<ObservabilitySavedViewsProps, 'searchParams' | 'setSearchParams' | 'className'>;

/** Saved views of the logs page, placed by the host next to `LogsToolbar`. Renders nothing without a `SavedViewsProvider`. */
export function LogsSavedViews(props: LogsSavedViewsProps) {
  return <ObservabilitySavedViews page="logs" {...props} />;
}
