import type { ConnectionItem, GroupedConnections } from './types';

export const getGroupedConnectionsByAuthor = (
  connections: ConnectionItem[],
  isAdmin: boolean,
): GroupedConnections | null => {
  if (!isAdmin) return null;

  const authors = new Set(connections.flatMap(connection => (connection.authorId ? [connection.authorId] : [])));
  if (authors.size <= 1) return null;

  const groups = new Map<string, ConnectionItem[]>();
  for (const connection of connections) {
    const key = connection.authorId ?? '(unknown)';
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
