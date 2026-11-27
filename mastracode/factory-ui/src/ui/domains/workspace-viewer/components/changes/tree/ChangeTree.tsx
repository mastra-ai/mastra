import type { WorkspaceChanges } from '../../../../../../api/types';
import { buildChangeTree, groupedRepositories, repositoryProvider } from './change-tree';
import type { RepositoryProviders } from './change-tree';
import { ChangeFileTree } from './ChangeFileTree';
import type { ChangeTreeFolderState } from './ChangeFileTree';
import { RepositoryChangesGroup } from './RepositoryChangesGroup';

interface ChangeTreeProps extends ChangeTreeFolderState {
  changes: WorkspaceChanges;
  repositoryProviders?: RepositoryProviders;
  selectedPath?: string;
  onSelect: (path: string) => void;
}

export function ChangeTree({
  changes,
  repositoryProviders,
  openFolders,
  onFolderOpenChange,
  selectedPath,
  onSelect,
}: ChangeTreeProps) {
  const repositories = groupedRepositories(changes);

  if (!repositories) {
    return (
      <ChangeFileTree
        nodes={buildChangeTree(changes.changes)}
        openFolders={openFolders}
        onFolderOpenChange={onFolderOpenChange}
        selectedPath={selectedPath}
        onSelect={onSelect}
        className="p-2"
      />
    );
  }

  return (
    <div className="flex flex-col p-2">
      {repositories.map(repository => (
        <RepositoryChangesGroup
          key={repository.prefix}
          repository={repository}
          provider={repositoryProvider(repositoryProviders, repository.slug)}
          openFolders={openFolders}
          onFolderOpenChange={onFolderOpenChange}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
