import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';

export type WorkSource = 'linear' | 'jira' | 'incident-io';

export const WORK_SOURCES: readonly WorkSource[] = ['linear', 'jira', 'incident-io'];

export const WORK_SOURCE_NAME: Record<WorkSource, string> = {
  linear: 'Linear',
  jira: 'Jira',
  'incident-io': 'incident.io',
};

export interface WorkSourceConnectionsStatus {
  connected: Record<WorkSource, boolean>;
  /** Some source has not answered yet, so `connected` may still flip to true. */
  isPending: boolean;
  /** Some source failed to load. A deployment without Platform connections (403/404) is not a failure. */
  isError: boolean;
}

export function useWorkSourceConnectionsStatus(): WorkSourceConnectionsStatus {
  const linear = useLinearStatusQuery();
  const jira = usePlatformConnectionsQuery('jira');
  const incidentIo = usePlatformConnectionsQuery('incident-io');
  const platforms = [jira, incidentIo];
  return {
    connected: {
      linear: linear.data?.connected === true,
      jira: jira.data?.some(connection => connection.status === 'active') === true,
      'incident-io': incidentIo.data?.some(connection => connection.status === 'active') === true,
    },
    isPending: linear.isPending || platforms.some(query => query.isPending),
    isError:
      linear.isError || platforms.some(query => query.isError && !isPlatformConnectUnavailableError(query.error)),
  };
}

export function useWorkSourceConnections(): Record<WorkSource, boolean> {
  return useWorkSourceConnectionsStatus().connected;
}
