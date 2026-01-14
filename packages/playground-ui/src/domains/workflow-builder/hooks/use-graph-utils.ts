import { useMemo } from 'react';
import type { BuilderNode, BuilderEdge } from '../types';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

/**
 * Gets all predecessor node IDs (nodes that can flow data to the target).
 * Uses BFS traversal through the reverse adjacency graph.
 *
 * @param nodeId - The target node to find predecessors for
 * @param edges - The graph edges
 * @param excludeTrigger - Whether to exclude the trigger node (default: false)
 * @returns Array of predecessor node IDs
 */
export function getPredecessorIds(nodeId: string, edges: BuilderEdge[], excludeTrigger = false): string[] {
  const predecessors: string[] = [];
  const visited = new Set<string>();

  // Build reverse adjacency list (target -> sources)
  const reverseAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) {
      reverseAdj.set(edge.target, []);
    }
    reverseAdj.get(edge.target)!.push(edge.source);
  }

  // BFS to find all predecessors
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const sources = reverseAdj.get(current) || [];
    for (const source of sources) {
      if (!visited.has(source)) {
        if (!excludeTrigger || source !== 'trigger') {
          predecessors.push(source);
        }
        queue.push(source);
      }
    }
  }

  return predecessors;
}

/**
 * Gets all predecessor node IDs as a Set for efficient lookup.
 *
 * @param nodeId - The target node to find predecessors for
 * @param edges - The graph edges
 * @param excludeTrigger - Whether to exclude the trigger node (default: false)
 * @returns Set of predecessor node IDs
 */
export function getPredecessorSet(nodeId: string, edges: BuilderEdge[], excludeTrigger = false): Set<string> {
  return new Set(getPredecessorIds(nodeId, edges, excludeTrigger));
}

/**
 * Hook to get predecessor node IDs for a given node.
 * Automatically subscribes to the workflow builder store for edges.
 *
 * @param nodeId - The target node to find predecessors for
 * @param excludeTrigger - Whether to exclude the trigger node (default: true for step references)
 * @returns Array of predecessor node IDs
 */
export function usePredecessorIds(nodeId: string, excludeTrigger = true): string[] {
  const edges = useWorkflowBuilderStore(state => state.edges);

  return useMemo(() => getPredecessorIds(nodeId, edges, excludeTrigger), [nodeId, edges, excludeTrigger]);
}

/**
 * Hook to get predecessor node IDs as a Set for efficient lookup.
 *
 * @param nodeId - The target node to find predecessors for
 * @param excludeTrigger - Whether to exclude the trigger node (default: true for step references)
 * @returns Set of predecessor node IDs
 */
export function usePredecessorSet(nodeId: string, excludeTrigger = true): Set<string> {
  const edges = useWorkflowBuilderStore(state => state.edges);

  return useMemo(() => getPredecessorSet(nodeId, edges, excludeTrigger), [nodeId, edges, excludeTrigger]);
}

/**
 * Hook to get predecessor nodes (full node objects).
 *
 * @param nodeId - The target node to find predecessors for
 * @param excludeTrigger - Whether to exclude the trigger node (default: true)
 * @returns Array of predecessor BuilderNode objects
 */
export function usePredecessorNodes(nodeId: string, excludeTrigger = true): BuilderNode[] {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);

  return useMemo(() => {
    const predecessorIds = getPredecessorSet(nodeId, edges, excludeTrigger);
    return nodes.filter(node => predecessorIds.has(node.id));
  }, [nodeId, nodes, edges, excludeTrigger]);
}
