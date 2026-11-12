import { sourceSuggestions } from '../ui/domains/settings/components/sourceSuggestions';
import type { SourceOption } from '../ui/domains/settings/components/sourceSuggestions';
import { useFactoryQuery } from './useFactories';
import { useIntakeBindingsQuery } from './useIntakeConfig';
import { useJiraProjectsQuery } from './useJiraData';
import { useLinearProjectListingQuery, useLinearTeamListingQuery } from './useLinearData';

/**
 * The values `source.repository` takes for a Factory project's items, from data Settings already
 * loads: its linked repositories, and the Linear teams and Jira projects bound to it. Linear and Jira
 * are only asked when the project has a source there; a listing that fails leaves its values out.
 */
export function useSourceSuggestions(factoryProjectId: string): SourceOption[] {
  const factory = useFactoryQuery(factoryProjectId);
  const bindings = useIntakeBindingsQuery();
  const bound = (integrationId: string) =>
    (bindings.data ?? []).some(
      binding => binding.integrationId === integrationId && binding.factoryProjectId === factoryProjectId,
    );
  const linearProjects = useLinearProjectListingQuery(bound('linear'));
  const linearTeams = useLinearTeamListingQuery(bound('linear'));
  const jiraProjects = useJiraProjectsQuery(bound('jira'));
  return sourceSuggestions({
    factoryProjectId,
    repositories: factory.data?.repositories,
    bindings: bindings.data,
    linearProjects: linearProjects.data?.projects,
    linearTeams: linearTeams.data?.teams,
    jiraProjects: jiraProjects.data,
  });
}
