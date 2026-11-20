import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { activePlatformConnectionQueryOptions } from '../../../../hooks/usePlatformConnections';

export function useBoardFilterSources() {
  const { baseUrl } = useApiConfig();
  const githubStatus = useGithubStatusQuery();
  const gitlabStatus = useGitLabStatusQuery();
  const linearStatus = useLinearStatusQuery();
  const jiraStatus = useJiraStatusQuery();
  const incidentioStatus = useIncidentioStatusQuery();
  // Vanta connects through Platform only.
  const vantaConnected = useQuery(activePlatformConnectionQueryOptions(baseUrl, 'vanta'));
  const linearProjects = useLinearProjectsQuery(Boolean(linearStatus.data?.connected));

  const connectedSources = new Set([
    ...(githubStatus.data?.connected ? ['github'] : []),
    ...(gitlabStatus.data?.enabled && gitlabStatus.data.configured ? ['gitlab'] : []),
    ...(linearStatus.data?.enabled && linearStatus.data.connected ? ['linear'] : []),
    ...(jiraStatus.data?.enabled && jiraStatus.data.configured ? ['jira'] : []),
    ...(incidentioStatus.data?.enabled && incidentioStatus.data.configured ? ['incidentio'] : []),
    ...(vantaConnected.data ? ['vanta'] : []),
  ]);

  return { connectedSources, linearProjects: linearProjects.data };
}
