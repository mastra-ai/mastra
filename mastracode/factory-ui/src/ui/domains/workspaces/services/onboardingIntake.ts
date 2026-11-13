/**
 * The intake writes setup makes once the Factory project exists and its repository is linked, with
 * the Work step's switch on. GitHub and GitLab go through the same path, so either both land or
 * setup warns the same way for both. With the switch off, setup calls none of this.
 */
import {
  fetchIntakeConfig,
  saveIntakeBinding,
  saveIntakeSelection,
  selectIntakeSource,
} from '../../factory/services/intake';
import { isGitLabRepository } from './github';
import type { SourceControlRepository } from './github';

/**
 * Select the codebase step's repository as an issue source. A GitLab project is routed to the new
 * Factory first, since routed intake needs a binding to feed its board; that rejects with
 * `IntakeBindingConflictError` when another Factory already takes the project, and nothing is
 * selected then.
 */
export async function applyCodeHostIntake(
  baseUrl: string,
  { factoryProjectId, repository }: { factoryProjectId: string; repository: SourceControlRepository },
): Promise<void> {
  const gitlab = isGitLabRepository(repository);
  if (gitlab) {
    await saveIntakeBinding(baseUrl, { integrationId: 'gitlab', sourceId: repository.id, factoryProjectId });
  }
  const integrationId = gitlab ? 'gitlab' : 'github';
  const config = await fetchIntakeConfig(baseUrl);
  const current = config[integrationId];
  const selection = selectIntakeSource(current, gitlab ? repository.id : repository.fullName);
  if (selection !== current) await saveIntakeSelection(baseUrl, integrationId, selection);
}
