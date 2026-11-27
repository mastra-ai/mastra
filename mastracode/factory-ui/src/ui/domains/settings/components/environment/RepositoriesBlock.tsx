import { RepositoryList } from '@mastra/playground-ui/components/RepositoryList';

import type {
  FactoryEnvironmentRepository,
  FactoryEnvironmentRepositoryPatch,
} from '../../../workspaces/services/environment';
import type { SaveEnvironment } from './CommittedInput';

// Number every link 1..n (dead links last) and send only ids + positions so concurrent edits survive.
export function reorderPatch(ordered: FactoryEnvironmentRepository[]): FactoryEnvironmentRepositoryPatch[] {
  return ordered.map((repository, index) => ({
    projectRepositoryId: repository.projectRepositoryId,
    position: index + 1,
  }));
}

export type RepositoryProviders = Record<string, 'github' | 'gitlab'>;

export function RepositoriesBlock({
  repositories,
  providers,
  disabled,
  onSave,
  onRemove,
  removingId,
  removeError,
}: {
  repositories: FactoryEnvironmentRepository[];
  providers: RepositoryProviders;
  disabled: boolean;
  onSave: SaveEnvironment;
  onRemove: (projectRepositoryId: string) => void;
  removingId?: string;
  removeError?: { projectRepositoryId: string; message: string };
}) {
  const ordered = [...repositories].sort((a, b) => a.position - b.position);
  const byId = new Map(ordered.map(repository => [repository.projectRepositoryId, repository]));
  const change = (patch: FactoryEnvironmentRepositoryPatch) => onSave({ repositories: [patch] });

  return (
    <RepositoryList
      repositories={ordered.map(repository => ({
        id: repository.projectRepositoryId,
        label: repository.slug,
        provider: providers[repository.projectRepositoryId] ?? 'github',
        preClone: repository.inEnvironment,
        defaultBranch: repository.defaultBranch,
        setupCommand: repository.setupCommand,
        teardownCommand: repository.teardownCommand,
        lastBuildFailed: repository.lastBuildStatus === 'failed',
        lastBuildError: repository.lastBuildError,
      }))}
      disabled={disabled}
      onReorder={ids => void onSave({ repositories: reorderPatch(ids.flatMap(id => byId.get(id) ?? [])) })}
      onPreCloneChange={(projectRepositoryId, inEnvironment) => void change({ projectRepositoryId, inEnvironment })}
      onCommandsChange={(projectRepositoryId, commands) => change({ projectRepositoryId, ...commands })}
      onRemove={onRemove}
      removingId={removingId}
      removeError={removeError && { id: removeError.projectRepositoryId, message: removeError.message }}
    />
  );
}
