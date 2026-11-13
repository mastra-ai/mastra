/**
 * The one intake write setup makes, once the Factory project exists.
 *
 * Linking the repository already selects it as an intake source (`useLinkRepositoryMutation`), and
 * with the Work step's switch off the link is told to skip that selection altogether, so a GitHub
 * repository needs nothing here: its issues reach the board from `config.github.sourceIds` alone. A
 * GitLab project is different — routed intake also needs a binding naming the Factory whose board
 * the issues feed, which is all this does.
 */
import { saveIntakeBinding } from '../../factory/services/intake';
import { isGitLabRepository } from './github';
import type { SourceControlRepository } from './github';

/**
 * Route the codebase step's GitLab project to the new Factory. Rejects with
 * `IntakeBindingConflictError` when another Factory already takes the project, in which case its
 * issues would never reach this Factory's board.
 */
export async function routeCodeHostIntake(
  baseUrl: string,
  { factoryProjectId, repository }: { factoryProjectId: string; repository: SourceControlRepository },
): Promise<void> {
  if (!isGitLabRepository(repository)) return;
  await saveIntakeBinding(baseUrl, { integrationId: 'gitlab', sourceId: repository.id, factoryProjectId });
}
