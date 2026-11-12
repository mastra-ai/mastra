/**
 * The one intake write setup makes, once the Factory project exists.
 *
 * Linking the repository already selects it as an intake source
 * (`useLinkRepositoryMutation`), so the Work step's switch only has to turn that selection back
 * off, and for GitLab also route the project to the new Factory: GitHub issues reach the board
 * from `config.github.sourceIds` alone, while routed intake needs a binding.
 */
import {
  fetchIntakeConfig,
  saveIntakeBinding,
  saveIntakeSelection,
  selectIntakeSource,
} from '../../factory/services/intake';
import type { IntakeSelection } from '../../factory/services/intake';
import { isGitLabRepository } from './github';
import type { SourceControlRepository } from './github';

/** The id the repository is selected by: a GitHub repo by slug, a GitLab project by its opaque id. */
export function codeHostSourceId(repository: SourceControlRepository): string {
  return isGitLabRepository(repository) ? repository.id : repository.fullName;
}

/**
 * Drop `id` from the selection, leaving `enabled` as the user had it. A list that empties becomes
 * `null` ("nothing selected"), matching what the pickers write.
 */
export function withoutIntakeSource(selection: IntakeSelection, id: string): IntakeSelection {
  if (selection.sourceIds === null || !selection.sourceIds.includes(id)) return selection;
  const sourceIds = selection.sourceIds.filter(sourceId => sourceId !== id);
  return { ...selection, sourceIds: sourceIds.length > 0 ? sourceIds : null };
}

export interface CodeHostIntakeWrite {
  factoryProjectId: string;
  repository: SourceControlRepository;
  /** The Work step's switch: on takes the repository's issues, off leaves them out. */
  enabled: boolean;
}

/**
 * Apply the Work step's choice to the org's intake config. With the switch on the repository is
 * already selected by the link, so only GitLab needs a binding; with it off the selection is
 * dropped and no binding is created. Rejects with `IntakeBindingConflictError` when another
 * Factory already takes the project.
 */
export async function applyCodeHostIntake(
  baseUrl: string,
  { factoryProjectId, repository, enabled }: CodeHostIntakeWrite,
): Promise<void> {
  const integrationId = isGitLabRepository(repository) ? 'gitlab' : 'github';
  const sourceId = codeHostSourceId(repository);
  // Route before selecting: a project another Factory already takes must fail before it is picked.
  if (enabled && integrationId === 'gitlab') {
    await saveIntakeBinding(baseUrl, { integrationId, sourceId, factoryProjectId });
  }
  const config = await fetchIntakeConfig(baseUrl);
  const current = config[integrationId];
  const next = enabled ? selectIntakeSource(current, sourceId) : withoutIntakeSource(current, sourceId);
  if (next === current) return;
  await saveIntakeSelection(baseUrl, integrationId, next);
}
