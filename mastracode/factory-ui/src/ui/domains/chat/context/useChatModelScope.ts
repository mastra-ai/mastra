import { useParams } from 'react-router';

import type { AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { useChatSessionContext } from './useChatSessionContext';

/** Presentation scope only; the server still authorizes each invocation from its run binding. */
export function useChatModelScope() {
  const { factoryId: routeFactoryId } = useParams<{ factoryId: string }>();
  const { kind, factorySessionState } = useChatSessionContext();
  const factoryId = factorySessionState?.factoryProjectId ?? routeFactoryId;
  const projectQuery = useFactoryProjectQuery(factoryId);
  const storedScope = projectQuery.data?.modelScope;
  const modelScope = storedScope === 'hybrid' ? kind : storedScope;
  const catalogTarget: AvailableModelsTarget =
    storedScope === 'hybrid' && kind === 'user' ? { scope: 'user' } : factoryId;

  return { factoryId, projectQuery, modelScope, catalogTarget };
}
