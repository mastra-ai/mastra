import type { TreeRow } from './tree-root';

export type FlatTreeRow<Node> = TreeRow & { node: Node };

export interface FlattenTreeOptions<Node> {
  getId: (node: Node) => string;
  getChildren: (node: Node) => readonly Node[] | undefined;
  isOpen: (id: string) => boolean;
}

export function flattenTreeRows<Node>(nodes: readonly Node[], options: FlattenTreeOptions<Node>) {
  const rows: FlatTreeRow<Node>[] = [];
  const addLevel = (level: readonly Node[], depth: number) =>
    level.forEach((node, index) => {
      const id = options.getId(node);
      const children = options.getChildren(node);
      const expanded = children ? options.isOpen(id) : undefined;
      rows.push({ id, node, level: depth, posInSet: index + 1, setSize: level.length, expanded });
      if (expanded && children) addLevel(children, depth + 1);
    });
  addLevel(nodes, 0);
  return rows;
}
