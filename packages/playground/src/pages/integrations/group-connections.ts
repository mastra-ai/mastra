import type { ConnectionItem, GroupedConnections } from './types';

const getAuthorGroupKey = (connection: ConnectionItem) => connection.authorId?.trim() || 'shared';

export const getGroupedConnectionsByAuthor = (
  connections: ConnectionItem[],
  isAdmin: boolean,
): GroupedConnections | null => {
  if (!isAdmin) return null;

  const authors = new Set(connections.map(getAuthorGroupKey));
  if (authors.size <= 1) return null;

  const groups = new Map<string, ConnectionItem[]>();
  for (const connection of connections) {
    const key = getAuthorGroupKey(connection);
    groups.set(key, [...(groups.get(key) ?? []), connection]);
  }

  const sortedGroups = Array.from(groups.entries());
  sortedGroups.sort(([a], [b]) => {
    if (a === 'shared') return 1;
    if (b === 'shared') return -1;
    return a.localeCompare(b);
  });
  return sortedGroups;
};
