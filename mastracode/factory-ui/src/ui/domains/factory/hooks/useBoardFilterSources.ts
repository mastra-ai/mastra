import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';

export function useBoardFilterSources() {
  const githubStatus = useGithubStatusQuery();
  const gitlabStatus = useGitLabStatusQuery();
  const linearStatus = useLinearStatusQuery();
  const jiraStatus = useJiraStatusQuery();
  const incidentioStatus = useIncidentioStatusQuery();
  // Vanta connects through Platform only; a deployment without Platform answers 403/404 and offers no Vanta.
  const vantaConnections = usePlatformConnectionsQuery('vanta');
  const linearProjects = useLinearProjectsQuery(Boolean(linearStatus.data?.connected));

  const connectedSources = new Set([
    ...(githubStatus.data?.connected ? ['github'] : []),
    ...(gitlabStatus.data?.enabled && gitlabStatus.data.configured ? ['gitlab'] : []),
    ...(linearStatus.data?.enabled && linearStatus.data.connected ? ['linear'] : []),
    ...(jiraStatus.data?.enabled && jiraStatus.data.configured ? ['jira'] : []),
    ...(incidentioStatus.data?.enabled && incidentioStatus.data.configured ? ['incidentio'] : []),
    ...(vantaConnections.data?.some(connection => connection.status === 'active') ? ['vanta'] : []),
  ]);

  return { connectedSources, linearProjects: linearProjects.data };
}
