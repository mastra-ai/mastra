import { useStore } from '@xyflow/react';

interface NodeGeometry {
  x: number;
  y: number;
  size: number;
}

function sameGeometry(a: NodeGeometry | undefined, b: NodeGeometry | undefined): boolean {
  if (a === b) return true;
  return Boolean(a && b && a.x === b.x && a.y === b.y && a.size === b.size);
}

/** Edges subscribe to geometry, not hover, selection or other node data. */
export function useKnowledgeNodeGeometry(id: string) {
  return useStore(state => {
    const node = state.nodeLookup.get(id);
    if (!node) return undefined;
    return {
      x: node.internals.positionAbsolute.x,
      y: node.internals.positionAbsolute.y,
      size: node.width ?? 0,
    };
  }, sameGeometry);
}
