import type { TreeRow } from './tree-root';

export type FlatTreeRow<Node> = TreeRow & { node: Node };

export interface FlattenTreeOptions<Node> {
  getId: (node: Node) => string;
  getChildren: (node: Node) => readonly Node[] | undefined;
  isOpen: (id: string) => boolean;
}

export function flattenTreeRows<Node>(nodes: readonly Node[], options: FlattenTreeOptions<Node>, level = 0) {
  const rows: FlatTreeRow<Node>[] = [];
  nodes.forEach((node, index) => {
    const id = options.getId(node);
    const children = options.getChildren(node);
    const expanded = children ? options.isOpen(id) : undefined;
    rows.push({ id, node, level, posInSet: index + 1, setSize: nodes.length, expanded });
    if (expanded && children) rows.push(...flattenTreeRows(children, options, level + 1));
  });
  return rows;
}
