import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';

export type WorkSource = 'linear' | 'jira' | 'incident-io';

export const WORK_SOURCES: readonly WorkSource[] = ['linear', 'jira', 'incident-io'];

export const WORK_SOURCE_NAME: Record<WorkSource, string> = {
  linear: 'Linear',
  jira: 'Jira',
  'incident-io': 'incident.io',
};

export function useWorkSourceConnections(): Record<WorkSource, boolean> {
  const linear = useLinearStatusQuery();
  const jira = usePlatformConnectionsQuery('jira');
  const incidentIo = usePlatformConnectionsQuery('incident-io');
  return {
    linear: linear.data?.connected === true,
    jira: jira.data?.some(connection => connection.status === 'active') === true,
    'incident-io': incidentIo.data?.some(connection => connection.status === 'active') === true,
  };
}
