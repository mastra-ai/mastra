import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { IntakeSourceBinding } from '../../factory/services/intake';
import type { JiraProject } from '../../factory/services/jira';
import type { LinearProject, LinearTeam } from '../../factory/services/linear';
import { linearTeamSourceId } from '../../factory/services/linear';
import type { Limit } from '../services/rules';
import { limitedProviders } from '../services/rules';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';

/** A value `source.repository` can take, and the provider whose items carry it. */
export type SourceOption = FilterBarOption & { provider: string };

/**
 * The values `source.repository` takes for the project's items: its linked GitHub repositories and
 * GitLab projects, then the team keys of its Linear sources and the keys of its Jira projects.
 */
export function sourceSuggestions({
  factoryProjectId,
  repositories = [],
  bindings = [],
  linearProjects = [],
  linearTeams = [],
  jiraProjects = [],
}: {
  factoryProjectId: string;
  repositories?: LinkedRepositoryPayload[];
  bindings?: IntakeSourceBinding[];
  linearProjects?: LinearProject[];
  linearTeams?: LinearTeam[];
  jiraProjects?: JiraProject[];
}): SourceOption[] {
  const bound = (integrationId: string) =>
    new Set(
      bindings
        .filter(binding => binding.integrationId === integrationId && binding.factoryProjectId === factoryProjectId)
        .map(binding => binding.sourceId),
    );
  const linear = bound('linear');
  const jira = bound('jira');
  const candidates: SourceOption[] = [
    ...repositories.map(repository => ({ value: repository.slug, provider: repository.provider ?? 'github' })),
    ...linearProjects
      .filter(project => linear.has(project.id))
      .flatMap(project => project.teams.map(team => ({ value: team.key, provider: 'linear' }))),
    ...linearTeams
      .filter(team => linear.has(linearTeamSourceId(team)))
      .map(team => ({ value: team.key, provider: 'linear' })),
    ...jiraProjects.filter(project => jira.has(project.id)).map(project => ({ value: project.key, provider: 'jira' })),
  ];
  // Case doesn't matter to the rule, so ENG from a project and from its team is one value.
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = `${candidate.provider}\0${candidate.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const hasProvider = (option: FilterBarOption): option is SourceOption =>
  'provider' in option && typeof option.provider === 'string';

/**
 * A field with its suggestions cut to the providers the conditions beside it allow, each value once:
 * the rule compares values regardless of provider or case, so Linear's ENG and Jira's ENG are one.
 */
export function narrowSuggestions(field: FilterBarField, limits: readonly Limit[]): FilterBarField {
  if (!Array.isArray(field.suggestions)) return field;
  const providers = limitedProviders(limits);
  const seen = new Set<string>();
  return {
    ...field,
    suggestions: field.suggestions.filter(option => {
      if (providers && hasProvider(option) && !providers.has(option.provider)) return false;
      const key = option.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}
