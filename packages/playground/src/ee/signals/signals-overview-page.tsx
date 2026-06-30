import { SignalsOverviewPage as SignalsOverviewPageContent } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import type { SignalsOverviewPageProps } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function SignalsOverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const selectedEntity = useMemo(
    () => (entityType && entityId ? { entityType, entityId } : null),
    [entityType, entityId],
  );

  const handleEntityChange = useCallback<SignalsOverviewPageProps['onEntityChange']>(
    selected => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (selected) {
            next.set('entityType', selected.entityType);
            next.set('entityId', selected.entityId);
          } else {
            next.delete('entityType');
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
    signalName => {
      const query = selectedEntity
        ? `?entityType=${encodeURIComponent(selectedEntity.entityType)}&entityId=${encodeURIComponent(selectedEntity.entityId)}`
        : '';
      void navigate(`/signals/${signalName}${query}`, { viewTransition: true });
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
