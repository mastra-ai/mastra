import type { EntityType } from '@mastra/core/observability';
import type { SetURLSearchParamsLike } from '@mastra/playground-ui/sort/use-url-sort';
import { useEffect } from 'react';

/**
 * Pins the scope params (`rootEntityType`, `filterEntityId`) of a scoped traces page in the URL.
 *
 * Must be called before `useTraceFilterPersistence`: react-router resolves functional
 * `setSearchParams` updates against the render-time params, so within one commit the last
 * call wins. Scoping first lets hydration (which re-runs only once) land on top of it.
 */
export function useTracesScopeParams(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParamsLike,
  scopedEntityId: string | undefined,
  scopedEntityType: EntityType | undefined,
) {
  useEffect(() => {
    if (!scopedEntityId) return;
    const currentRoot = searchParams.get('rootEntityType');
    const currentEntityId = searchParams.get('filterEntityId');
    const needsRoot = !!scopedEntityType && currentRoot !== scopedEntityType;
    const needsEntityId = currentEntityId !== scopedEntityId;
    if (!needsRoot && !needsEntityId) return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (scopedEntityType) next.set('rootEntityType', scopedEntityType);
        next.set('filterEntityId', scopedEntityId);
        return next;
      },
      { replace: true },
    );
  }, [scopedEntityId, scopedEntityType, searchParams, setSearchParams]);
}
