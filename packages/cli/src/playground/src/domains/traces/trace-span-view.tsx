import { TreeNode } from './trace-tree-view';
import { Span, SpanNode } from './types';

export function TreeView({ tree }: { tree: SpanNode[] }) {
  return (
    <ul>
      {tree.map(node => (
        <TreeNode key={node.id} node={node} />
      ))}
    </ul>
  );
}

function buildTree(items: Span[], parentSpanId: string | null = null): SpanNode[] {
  return items
    .filter(item => item.parentSpanId === parentSpanId)
    .map(item => ({
      ...item,
      children: buildTree(items, item.id),
    }));
}

export default function SpanView({ trace }: { trace: Span[] }) {
  // SQL query sorts by startTime in descending order, so we need to reverse and copy the array for spans to show in correct order
  const tree = buildTree(trace.concat([])!.reverse());

  return (
    <div>
      <TreeView tree={tree} />
    </div>
  );
}
