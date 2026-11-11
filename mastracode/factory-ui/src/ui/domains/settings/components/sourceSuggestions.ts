import type { FilterBarField, FilterBarOption } from '@mastra/playground-ui/components/FilterBar';

import type { IntakeSourceBinding } from '../../factory/services/intake';
import type { JiraProject } from '../../factory/services/jira';
import type { LinearProject, LinearTeam } from '../../factory/services/linear';
import { linearTeamSourceId } from '../../factory/services/linear';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';

/** A value `source.repository` can take, and the provider whose items carry it. */
export type SourceOption = FilterBarOption & { provider: string };

const PROVIDER_FIELDS = new Set(['source.provider', 'source.integration']);

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

type Limit = { field: string; operator: string; value?: unknown };

/** The providers conditions ANDed with a row allow, or `undefined` when none limits them. */
export function limitedProviders(limits: readonly Limit[]): Set<string> | undefined {
  let allowed: Set<string> | undefined;
  for (const limit of limits) {
    if (!PROVIDER_FIELDS.has(limit.field)) continue;
    const values =
      limit.operator === 'equals' && typeof limit.value === 'string'
        ? [limit.value]
        : limit.operator === 'in' && Array.isArray(limit.value)
          ? limit.value.filter((value): value is string => typeof value === 'string')
          : undefined;
    if (!values) continue;
    const these = new Set(values.map(value => value.trim().toLowerCase()));
    allowed = allowed ? new Set([...allowed].filter(provider => these.has(provider))) : these;
  }
  return allowed;
}

const hasProvider = (option: FilterBarOption): option is SourceOption =>
  'provider' in option && typeof option.provider === 'string';

/** A field with its suggestions cut to the providers the conditions beside it allow. */
export function narrowSuggestions(field: FilterBarField, limits: readonly Limit[]): FilterBarField {
  if (!Array.isArray(field.suggestions)) return field;
  const providers = limitedProviders(limits);
  if (!providers) return field;
  return {
    ...field,
    suggestions: field.suggestions.filter(option => !hasProvider(option) || providers.has(option.provider)),
  };
}
