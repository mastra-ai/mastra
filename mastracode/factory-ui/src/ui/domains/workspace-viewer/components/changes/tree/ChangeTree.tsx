import { Tree } from '@mastra/playground-ui/components/Tree';

import type { WorkspaceChanges } from '../../../../../../api/types';
import { buildChangeTree, groupedRepositories, repositoryProvider } from './change-tree';
import type { RepositoryProviders } from './change-tree';
import { ChangeTreeItem } from './ChangeTreeItem';
import type { ChangeTreeFolderState } from './ChangeTreeItem';
import { RepositoryChangesGroup } from './RepositoryChangesGroup';

interface ChangeTreeProps extends ChangeTreeFolderState {
  changes: WorkspaceChanges;
  repositoryProviders?: RepositoryProviders;
  selectedPath?: string;
  onSelect: (path: string) => void;
}

/** The changed files as a folder tree, grouped by repository when the session holds several. */
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
      <Tree selectedId={selectedPath} onSelect={onSelect} className="p-2">
        {buildChangeTree(changes.changes).map(node => (
          <ChangeTreeItem
            key={node.path}
            node={node}
            openFolders={openFolders}
            onFolderOpenChange={onFolderOpenChange}
          />
        ))}
      </Tree>
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
