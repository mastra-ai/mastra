import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { savedModelScope } from './models/routing/model-routes';
import type { ModelDefaults } from './models/routing/model-routes';
import { UsedByLanes } from './models/routing/UsedByLanes';

export function MemoryUsedBy({ factoryId, defaults }: { factoryId: string; defaults: ModelDefaults }) {
  const authQuery = useFactoryAuth();
  const projectQuery = useFactoryProjectQuery(factoryId);
  if (!authQuery.data || !projectQuery.data) return null;

  // Sign-in off: one process-wide credential set pays for every thread, so all read the Factory's row.
  const memoryScope = authQuery.data.authEnabled ? savedModelScope(projectQuery.data) : 'factory';
  return <UsedByLanes scope={memoryScope} defaults={defaults} />;
}
