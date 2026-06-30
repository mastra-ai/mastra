import { getSignalName } from '@mastra/playground-ui/ee/signals/components/signal-details-utils';
import { Link, useParams, useSearchParams } from 'react-router';

export function SignalCrumb() {
  const { signalId } = useParams<{ signalId: string }>();
  if (!signalId) return null;

  return getSignalName(signalId);
}

/**
 * Root "Signals" breadcrumb that links back to the overview while preserving the
 * current entity context (`entityType`/`entityId`) from the URL, so navigating
 * up keeps the selected entity instead of resetting the overview.
 */
export function SignalsRootCrumb() {
  const [searchParams] = useSearchParams();

  const preserved = new URLSearchParams();
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  if (entityType) preserved.set('entityType', entityType);
  if (entityId) preserved.set('entityId', entityId);

  const query = preserved.toString();
  const to = query ? `/signals?${query}` : '/signals';

  return <Link to={to}>Signals</Link>;
}
