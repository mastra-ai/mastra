import { SignalsOverviewPage as SignalsOverviewPageContent } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import type { SignalsOverviewPageProps } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function SignalsOverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const entityId = searchParams.get('entityId');
  const selectedEntity = useMemo(() => (entityId ? { entityType: 'agent', entityId } : null), [entityId]);

  const handleEntityChange = useCallback<SignalsOverviewPageProps['onEntityChange']>(
    selected => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (selected) {
            next.set('entityId', selected.entityId);
          } else {
            next.delete('entityId');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSignalSelect = useCallback<SignalsOverviewPageProps['onSignalSelect']>(
    (signalName, topicId) => {
      const params = new URLSearchParams();
      if (selectedEntity) {
        params.set('entityId', selectedEntity.entityId);
      }
      if (topicId) {
        params.set('topicId', topicId);
      }
      const query = params.toString();
      void navigate(`/signals/${signalName}${query ? `?${query}` : ''}`, { viewTransition: true });
    },
    [navigate, selectedEntity],
  );

  return (
    <SignalsOverviewPageContent
      selectedEntity={selectedEntity}
      onEntityChange={handleEntityChange}
      onSignalSelect={handleSignalSelect}
    />
  );
}

export default SignalsOverviewPage;
