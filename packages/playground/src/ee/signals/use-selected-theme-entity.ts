import { useThemeEntities } from '@mastra/playground-ui/ee/signals';
import { useSearchParams } from 'react-router';

const AGENT_SEARCH_PARAM = 'agent';

/**
 * Selected trace-intelligence agent, shared between the breadcrumb selector
 * and the overview page through the `agent` URL search param. Falls back to
 * the first agent that can render a cross-signal flow.
 */
export function useSelectedThemeEntity() {
  const entitiesQuery = useThemeEntities('agent');
  const [searchParams, setSearchParams] = useSearchParams();

  const entities = entitiesQuery.data?.entities ?? [];
  const requestedEntityId = searchParams.get(AGENT_SEARCH_PARAM) ?? undefined;
  const entity =
    entities.find(candidate => candidate.entityId === requestedEntityId) ??
    entities.find(candidate => candidate.availableSignals.length >= 2) ??
    entities[0];

  const selectEntity = (entityId: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        next.set(AGENT_SEARCH_PARAM, entityId);
        return next;
      },
      { replace: true },
    );
  };

  return { entitiesQuery, entities, entity, selectEntity };
}
