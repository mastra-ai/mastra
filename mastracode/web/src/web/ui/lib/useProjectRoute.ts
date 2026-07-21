import { useParams } from 'react-router';

import { useProjectNamespace } from './ProjectRouteContext';

export function useProjectRoute() {
  const namespace = useProjectNamespace();
  const { projectId } = useParams();
  const path = (destination: string) => {
    const normalizedDestination = destination.replace(/^\//, '');
    if (!namespace || !projectId) return `/${normalizedDestination}`;
    return `/${namespace}/${encodeURIComponent(projectId)}/${normalizedDestination}`;
  };
  return { namespace, projectId, path };
}
