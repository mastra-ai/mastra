import { EdgeLookup, NodeLookup, EdgeChange, NodeChange, NodeSelectionChange, EdgeSelectionChange, NodeRemoveChange, EdgeRemoveChange } from '@xyflow/system';
import type { Node, Edge, InternalNode } from '../types';
/**
 * Drop in function that applies node changes to an array of nodes.
 * @public
 * @param changes - Array of changes to apply.
 * @param nodes - Array of nodes to apply the changes to.
 * @returns Array of updated nodes.
 * @example
 *```tsx
 *import { useState, useCallback } from 'react';
 *import { ReactFlow, applyNodeChanges, type Node, type Edge, type OnNodesChange } from '@xyflow/react';
 *
 *export default function Flow() {
 *  const [nodes, setNodes] = useState<Node[]>([]);
 *  const [edges, setEdges] = useState<Edge[]>([]);
 *  const onNodesChange: OnNodesChange = useCallback(
 *    (changes) => {
 *      setNodes((oldNodes) => applyNodeChanges(changes, oldNodes));
 *    },
 *    [setNodes],
 *  );
 *
 *  return (
 *    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
 *  );
 *}
 *```
 * @remarks Various events on the <ReactFlow /> component can produce an {@link NodeChange}
 * that describes how to update the edges of your flow in some way.
 * If you don't need any custom behaviour, this util can be used to take an array
 * of these changes and apply them to your edges.
 */
export declare function applyNodeChanges<NodeType extends Node = Node>(changes: NodeChange<NodeType>[], nodes: NodeType[]): NodeType[];
/**
 * Drop in function that applies edge changes to an array of edges.
 * @public
 * @param changes - Array of changes to apply.
 * @param edges - Array of edge to apply the changes to.
 * @returns Array of updated edges.
 * @example
 * ```tsx
 *import { useState, useCallback } from 'react';
 *import { ReactFlow, applyEdgeChanges } from '@xyflow/react';
 *
 *export default function Flow() {
 *  const [nodes, setNodes] = useState([]);
 *  const [edges, setEdges] = useState([]);
 *  const onEdgesChange = useCallback(
 *    (changes) => {
 *      setEdges((oldEdges) => applyEdgeChanges(changes, oldEdges));
 *    },
 *    [setEdges],
 *  );
 *
 *  return (
 *    <ReactFlow nodes={nodes} edges={edges} onEdgesChange={onEdgesChange} />
 *  );
 *}
 *```
 * @remarks Various events on the <ReactFlow /> component can produce an {@link EdgeChange}
 * that describes how to update the edges of your flow in some way.
 * If you don't need any custom behaviour, this util can be used to take an array
 * of these changes and apply them to your edges.
 */
export declare function applyEdgeChanges<EdgeType extends Edge = Edge>(changes: EdgeChange<EdgeType>[], edges: EdgeType[]): EdgeType[];
export declare function createSelectionChange(id: string, selected: boolean): NodeSelectionChange | EdgeSelectionChange;
export declare function getSelectionChanges(items: Map<string, any>, selectedIds?: Set<string>, mutateItem?: boolean): NodeSelectionChange[] | EdgeSelectionChange[];
/**
 * This function is used to find the changes between two sets of elements.
 * It is used to determine which nodes or edges have been added, removed or replaced.
 *
 * @internal
 * @param params.items = the next set of elements (nodes or edges)
 * @param params.lookup = a lookup map of the current store elements
 * @returns an array of changes
 */
export declare function getElementsDiffChanges({ items, lookup, }: {
    items: Node[] | undefined;
    lookup: NodeLookup<InternalNode<Node>>;
}): NodeChange[];
export declare function getElementsDiffChanges({ items, lookup, }: {
    items: Edge[] | undefined;
    lookup: EdgeLookup;
}): EdgeChange[];
export declare function elementToRemoveChange<T extends Node | Edge>(item: T): NodeRemoveChange | EdgeRemoveChange;
//# sourceMappingURL=changes.d.ts.map