import { getSignalName } from '@mastra/playground-ui/ee/signals/components/signal-details-utils';
import { Link, useParams, useSearchParams } from 'react-router';

export function SignalCrumb() {
  const { signalId } = useParams<{ signalId: string }>();
  if (!signalId) return null;

  return getSignalName(signalId);
}

/**
 * Signal breadcrumb used on the trace route, where it links back to the signal
 * details page. It preserves the current query params (`entityId`, `topicId`,
 * …) so navigating up keeps the selected entity/topic instead of landing on the
 * details page empty state.
 */
export function SignalDetailsCrumb() {
  const { signalId } = useParams<{ signalId: string }>();
  const [searchParams] = useSearchParams();
  if (!signalId) return null;

  const search = searchParams.toString();
  const to = `/signals/${encodeURIComponent(signalId)}${search ? `?${search}` : ''}`;

  return <Link to={to}>{getSignalName(signalId)}</Link>;
}

/**
 * Root "Signals" breadcrumb that links back to the overview while preserving the
 * current entity context (`entityId`) from the URL, so navigating up keeps the
 * selected agent instead of resetting the overview.
 */
export function SignalsRootCrumb() {
  const [searchParams] = useSearchParams();

  const entityId = searchParams.get('entityId');
  const to = entityId ? `/signals?entityId=${encodeURIComponent(entityId)}` : '/signals';

  return <Link to={to}>Signals</Link>;
}
