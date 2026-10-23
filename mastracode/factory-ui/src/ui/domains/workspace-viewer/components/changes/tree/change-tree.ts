import type { WorkspaceChange, WorkspaceChanges } from '../../../../../../api/types';

export interface ChangeTreeNode {
  path: string;
  name: string;
  change?: WorkspaceChange;
  children: ChangeTreeNode[];
}

export type RepositoryProvider = 'github' | 'gitlab';

/** Source control provider per repository slug, from the factory's linked repositories. */
export type RepositoryProviders = Record<string, RepositoryProvider | undefined>;

function ensureChangeDirectory(nodes: ChangeTreeNode[], path: string, name: string): ChangeTreeNode {
  const existing = nodes.find(node => node.path === path);
  if (existing) return existing;

  const directory = { path, name, children: [] } satisfies ChangeTreeNode;
  nodes.push(directory);
  return directory;
}

function addChange(nodes: ChangeTreeNode[], change: WorkspaceChange, prefix: string) {
  const segments = change.path.slice(prefix.length).split('/').filter(Boolean);
  let siblings = nodes;
  let currentPath = prefix;

  segments.forEach((segment, index) => {
    currentPath = currentPath && !currentPath.endsWith('/') ? `${currentPath}/${segment}` : `${currentPath}${segment}`;
    if (index === segments.length - 1) {
      siblings.push({ path: change.path, name: segment, change, children: [] });
      return;
    }

    const directory = ensureChangeDirectory(siblings, currentPath, segment);
    siblings = directory.children;
  });
}

function compactChangeTree(node: ChangeTreeNode): ChangeTreeNode {
  let compacted = { ...node, children: sortChangeTree(node.children) };
  while (!compacted.change && compacted.children.length === 1 && !compacted.children[0]?.change) {
    const child = compacted.children[0];
    compacted = {
      path: child.path,
      name: `${compacted.name}/${child.name}`,
      children: child.children,
    };
  }
  return compacted;
}

function sortChangeTree(nodes: ChangeTreeNode[]): ChangeTreeNode[] {
  return nodes.map(compactChangeTree).sort((a, b) => {
    if (Boolean(a.change) !== Boolean(b.change)) return a.change ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Build the folder tree of a change list. `prefix` is the repository
 * directory the paths carry in a multi-repository session: it is stripped
 * for display only, every node keeps the prefixed path the routes expect.
 */
export function buildChangeTree(changes: WorkspaceChange[], prefix = ''): ChangeTreeNode[] {
  const nodes: ChangeTreeNode[] = [];
  changes.forEach(change => addChange(nodes, change, prefix));
  return sortChangeTree(nodes);
}

function treeChanges(nodes: ChangeTreeNode[]): WorkspaceChange[] {
  return nodes.flatMap(node => (node.change ? [node.change] : treeChanges(node.children)));
}

export function groupedRepositories(changes: WorkspaceChanges) {
  return changes.repositories && changes.repositories.length > 1 ? changes.repositories : undefined;
}

/** The changes in the order the tree lists them: repository by repository, folders before files. */
export function changesInTreeOrder(changes: WorkspaceChanges): WorkspaceChange[] {
  const repositories = groupedRepositories(changes);
  if (!repositories) return treeChanges(buildChangeTree(changes.changes));
  return repositories.flatMap(repository => treeChanges(buildChangeTree(repository.changes, repository.prefix)));
}

/** Unknown while the factory loads (no icon); a slug the factory doesn't list is shown as GitHub. */
export function repositoryProvider(
  repositoryProviders: RepositoryProviders | undefined,
  slug: string,
): RepositoryProvider | undefined {
  if (!repositoryProviders) return undefined;
  return repositoryProviders[slug.toLowerCase()] ?? 'github';
}
