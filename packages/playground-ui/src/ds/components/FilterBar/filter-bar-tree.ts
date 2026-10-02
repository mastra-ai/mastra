import type { FilterBarExpression, FilterBarGroup, FilterBarItem, FilterBarLogic, FilterBarNode } from './types';
import { isFilterBarGroup } from './types';

export type FilterBarValueInput = FilterBarItem[] | FilterBarExpression;

export const ROOT_GROUP_ID = 'root';

export const normalize = (value: FilterBarValueInput): FilterBarExpression =>
  Array.isArray(value) ? { logic: 'and', nodes: value } : value;

/** Hands back the shape the consumer gave us: flat arrays only ever contain items. */
export const denormalize = (expr: FilterBarExpression, flat: boolean): FilterBarValueInput =>
  flat ? expr.nodes.filter((node): node is FilterBarItem => !isFilterBarGroup(node)) : expr;

export type FlatEntry = { item: FilterBarItem; groupId?: string };

/**
 * Items in document order (pre-order, depth-first), each tagged with the group it lives
 * in. A group's leaves sit where its advanced chip sits in the bar, so arrow navigation
 * walks the bar left to right.
 */
export const flattenItems = (expr: FilterBarExpression): FlatEntry[] => {
  const out: FlatEntry[] = [];
  const walk = (nodes: FilterBarNode[], groupId: string | undefined) => {
    for (const node of nodes) {
      if (isFilterBarGroup(node)) walk(node.nodes, node.id);
      else out.push(groupId ? { item: node, groupId } : { item: node });
    }
  };
  walk(expr.nodes, undefined);
  return out;
};

const findGroupIn = (nodes: FilterBarNode[], groupId: string): FilterBarGroup | undefined => {
  for (const node of nodes) {
    if (!isFilterBarGroup(node)) continue;
    if (node.id === groupId) return node;
    const nested = findGroupIn(node.nodes, groupId);
    if (nested) return nested;
  }
  return undefined;
};

export const findGroup = (expr: FilterBarExpression, groupId: string): FilterBarGroup | undefined =>
  findGroupIn(expr.nodes, groupId);

export const findItem = (expr: FilterBarExpression, itemId: string): FlatEntry | undefined =>
  flattenItems(expr).find(entry => entry.item.id === itemId);

/** Nesting level of a group: root-level groups are at depth 1; `0` when not found. */
export const groupDepth = (expr: FilterBarExpression, groupId: string): number => {
  const walk = (nodes: FilterBarNode[], depth: number): number => {
    for (const node of nodes) {
      if (!isFilterBarGroup(node)) continue;
      if (node.id === groupId) return depth;
      const nested = walk(node.nodes, depth + 1);
      if (nested) return nested;
    }
    return 0;
  };
  return walk(expr.nodes, 1);
};

/** Number of leaf conditions under a group, at any depth. */
export const countLeaves = (group: FilterBarGroup): number =>
  group.nodes.reduce((sum, node) => sum + (isFilterBarGroup(node) ? countLeaves(node) : 1), 0);

/** Ids of a group and every node below it. */
export const collectIds = (group: FilterBarGroup): string[] => [
  group.id,
  ...group.nodes.flatMap(node => (isFilterBarGroup(node) ? collectIds(node) : [node.id])),
];

const mapGroup = (
  nodes: FilterBarNode[],
  groupId: string,
  fn: (group: FilterBarGroup) => FilterBarGroup,
): FilterBarNode[] =>
  nodes.map(node => {
    if (!isFilterBarGroup(node)) return node;
    return node.id === groupId ? fn(node) : { ...node, nodes: mapGroup(node.nodes, groupId, fn) };
  });

const mapItems = (nodes: FilterBarNode[], fn: (item: FilterBarItem) => FilterBarItem): FilterBarNode[] =>
  nodes.map(node => (isFilterBarGroup(node) ? { ...node, nodes: mapItems(node.nodes, fn) } : fn(node)));

const filterNodes = (nodes: FilterBarNode[], keep: (node: FilterBarNode) => boolean): FilterBarNode[] =>
  nodes.filter(keep).map(node => (isFilterBarGroup(node) ? { ...node, nodes: filterNodes(node.nodes, keep) } : node));

export const updateItem = (
  expr: FilterBarExpression,
  itemId: string,
  patch: Partial<Omit<FilterBarItem, 'id'>>,
): FilterBarExpression => ({
  ...expr,
  nodes: mapItems(expr.nodes, item => (item.id === itemId ? { ...item, ...patch } : item)),
});

/** Removes an item or a group by id at any depth. Groups left empty are kept (see `pruneEmptyGroups`). */
export const removeNode = (expr: FilterBarExpression, id: string): FilterBarExpression => ({
  ...expr,
  nodes: filterNodes(expr.nodes, node => node.id !== id),
});

export const removeNodes = (expr: FilterBarExpression, ids: Iterable<string>): FilterBarExpression => {
  const drop = new Set(ids);
  return { ...expr, nodes: filterNodes(expr.nodes, node => !drop.has(node.id)) };
};

const pruneNodes = (nodes: FilterBarNode[]): FilterBarNode[] =>
  nodes.flatMap((node): FilterBarNode[] => {
    if (!isFilterBarGroup(node)) return [node];
    const pruned = pruneNodes(node.nodes);
    return pruned.length === 0 ? [] : [{ ...node, nodes: pruned }];
  });

/** Drops every group with no leaf left, bottom-up. */
export const pruneEmptyGroups = (expr: FilterBarExpression): FilterBarExpression => ({
  ...expr,
  nodes: pruneNodes(expr.nodes),
});

export const insertItem = (
  expr: FilterBarExpression,
  groupId: string | undefined,
  item: FilterBarItem,
): FilterBarExpression => {
  if (!groupId || groupId === ROOT_GROUP_ID) return { ...expr, nodes: [...expr.nodes, item] };
  return { ...expr, nodes: mapGroup(expr.nodes, groupId, group => ({ ...group, nodes: [...group.nodes, item] })) };
};

export const setGroupLogic = (
  expr: FilterBarExpression,
  groupId: string,
  logic: FilterBarLogic,
): FilterBarExpression => {
  if (groupId === ROOT_GROUP_ID) return { ...expr, logic };
  return { ...expr, nodes: mapGroup(expr.nodes, groupId, group => ({ ...group, logic })) };
};

/** Appends a group to the root, or inside `parentId`. */
export const createGroup = (
  expr: FilterBarExpression,
  parentId: string | undefined,
  group: FilterBarGroup,
): FilterBarExpression => {
  if (!parentId || parentId === ROOT_GROUP_ID) return { ...expr, nodes: [...expr.nodes, group] };
  return { ...expr, nodes: mapGroup(expr.nodes, parentId, parent => ({ ...parent, nodes: [...parent.nodes, group] })) };
};

/** Drops removable items at any depth and every group that ends up empty; pinned items stay. */
export const clearRemovable = (expr: FilterBarExpression, pinned: ReadonlySet<string>): FilterBarExpression =>
  pruneEmptyGroups({
    ...expr,
    nodes: filterNodes(expr.nodes, node => isFilterBarGroup(node) || pinned.has(node.id)),
  });
