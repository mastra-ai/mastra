import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';

export function useBoardFilterSources() {
  const githubStatus = useGithubStatusQuery();
  const gitlabStatus = useGitLabStatusQuery();
  const linearStatus = useLinearStatusQuery();
  const jiraStatus = useJiraStatusQuery();
  const incidentioStatus = useIncidentioStatusQuery();
  const linearProjects = useLinearProjectsQuery(Boolean(linearStatus.data?.connected));

  const connectedSources = new Set([
    ...(githubStatus.data?.connected ? ['github'] : []),
    ...(gitlabStatus.data?.enabled && gitlabStatus.data.configured ? ['gitlab'] : []),
    ...(linearStatus.data?.enabled && linearStatus.data.connected ? ['linear'] : []),
    ...(jiraStatus.data?.enabled && jiraStatus.data.configured ? ['jira'] : []),
    ...(incidentioStatus.data?.enabled && incidentioStatus.data.configured ? ['incidentio'] : []),
  ]);

  return { connectedSources, linearProjects: linearProjects.data };
}
