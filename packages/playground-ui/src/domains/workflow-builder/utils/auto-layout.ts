import type { BuilderNode, BuilderEdge } from '../types';

// ============================================================================
// Layout Constants
// ============================================================================

export interface AutoLayoutOptions {
  /** Width of each node (default: 280) */
  nodeWidth?: number;
  /** Height of each node (default: 80) */
  nodeHeight?: number;
  /** Horizontal spacing between nodes in the same level (default: 100) */
  horizontalSpacing?: number;
  /** Vertical spacing between levels (default: 150) */
  verticalSpacing?: number;
}

const DEFAULT_OPTIONS: Required<AutoLayoutOptions> = {
  nodeWidth: 280,
  nodeHeight: 80,
  horizontalSpacing: 100,
  verticalSpacing: 150,
};

// ============================================================================
// Layout Result
// ============================================================================

export interface LayoutResult {
  nodes: BuilderNode[];
}

// ============================================================================
// Auto Layout Algorithm
// ============================================================================

/**
 * Automatically arranges workflow nodes in a hierarchical tree layout.
 *
 * Algorithm:
 * 1. Build adjacency map from edges
 * 2. Find trigger node (root)
 * 3. BFS from trigger, assign levels
 * 4. Group nodes by level
 * 5. Position each level:
 *    - y = level * verticalSpacing
 *    - x = center nodes horizontally with horizontalSpacing
 * 6. Handle disconnected nodes (place at bottom)
 */
export function autoLayout(nodes: BuilderNode[], edges: BuilderEdge[], options: AutoLayoutOptions = {}): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (nodes.length === 0) {
    return { nodes: [] };
  }

  // Build adjacency map (source -> targets)
  const adjacencyMap = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacencyMap.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyMap.set(edge.source, targets);
  }

  // Find trigger node (root)
  const triggerNode = nodes.find(n => n.data.type === 'trigger');
  const rootId = triggerNode?.id;

  // BFS to assign levels
  const nodeLevels = new Map<string, number>();
  const visited = new Set<string>();

  if (rootId) {
    const queue: Array<{ id: string; level: number }> = [{ id: rootId, level: 0 }];
    visited.add(rootId);
    nodeLevels.set(rootId, 0);

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const children = adjacencyMap.get(id) || [];

      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId);
          nodeLevels.set(childId, level + 1);
          queue.push({ id: childId, level: level + 1 });
        }
      }
    }
  }

  // Find disconnected nodes (not reachable from trigger)
  const disconnectedNodes = nodes.filter(n => !visited.has(n.id));

  // Group nodes by level
  const levelGroups = new Map<number, BuilderNode[]>();
  let maxLevel = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) {
      const level = nodeLevels.get(node.id)!;
      const group = levelGroups.get(level) || [];
      group.push(node);
      levelGroups.set(level, group);
      maxLevel = Math.max(maxLevel, level);
    }
  }

  // Calculate positions for each level
  const positionedNodes = new Map<string, { x: number; y: number }>();

  for (let level = 0; level <= maxLevel; level++) {
    const nodesInLevel = levelGroups.get(level) || [];
    const levelWidth = nodesInLevel.length * opts.nodeWidth + (nodesInLevel.length - 1) * opts.horizontalSpacing;

    // Sort nodes within level to maintain parent-child alignment
    // This helps keep children roughly under their parents
    if (level > 0) {
      nodesInLevel.sort((a, b) => {
        // Find parent positions and average them
        const getParentAvgX = (nodeId: string): number => {
          const parentEdges = edges.filter(e => e.target === nodeId);
          if (parentEdges.length === 0) return 0;

          let totalX = 0;
          let count = 0;
          for (const edge of parentEdges) {
            const parentPos = positionedNodes.get(edge.source);
            if (parentPos) {
              totalX += parentPos.x;
              count++;
            }
          }
          return count > 0 ? totalX / count : 0;
        };

        return getParentAvgX(a.id) - getParentAvgX(b.id);
      });
    }

    // Center the level horizontally (starting from x = 0 as center)
    const startX = -levelWidth / 2 + opts.nodeWidth / 2;
    const y = level * (opts.nodeHeight + opts.verticalSpacing);

    nodesInLevel.forEach((node, index) => {
      const x = startX + index * (opts.nodeWidth + opts.horizontalSpacing);
      positionedNodes.set(node.id, { x, y });
    });
  }

  // Position disconnected nodes at the bottom
  if (disconnectedNodes.length > 0) {
    const disconnectedLevel = maxLevel + 2; // Leave a gap
    const disconnectedWidth =
      disconnectedNodes.length * opts.nodeWidth + (disconnectedNodes.length - 1) * opts.horizontalSpacing;
    const startX = -disconnectedWidth / 2 + opts.nodeWidth / 2;
    const y = disconnectedLevel * (opts.nodeHeight + opts.verticalSpacing);

    disconnectedNodes.forEach((node, index) => {
      const x = startX + index * (opts.nodeWidth + opts.horizontalSpacing);
      positionedNodes.set(node.id, { x, y });
    });
  }

  // Create new nodes array with updated positions
  const layoutedNodes = nodes.map(node => {
    const position = positionedNodes.get(node.id);
    if (position) {
      return {
        ...node,
        position,
      };
    }
    return node;
  });

  return { nodes: layoutedNodes };
}
