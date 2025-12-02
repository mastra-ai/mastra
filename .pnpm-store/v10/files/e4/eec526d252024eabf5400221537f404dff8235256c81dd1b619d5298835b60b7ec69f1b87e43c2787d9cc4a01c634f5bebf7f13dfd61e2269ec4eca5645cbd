import type { Node } from '../types';
/**
 * This hook lets you subscribe to changes of a specific nodes `data` object.
 *
 * @public
 * @returns An object (or array of object) with `id`, `type`, `data` representing each node.
 *
 * @example
 *```jsx
 *import { useNodesData } from '@xyflow/react';
 *
 *export default function() {
 *  const nodeData = useNodesData('nodeId-1');
 *  const nodesData = useNodesData(['nodeId-1', 'nodeId-2']);
 *
 *  return null;
 *}
 *```
 */
export declare function useNodesData<NodeType extends Node = Node>(
/** The id of the node to get the data from. */
nodeId: string): Pick<NodeType, 'id' | 'type' | 'data'> | null;
export declare function useNodesData<NodeType extends Node = Node>(
/** The ids of the nodes to get the data from. */
nodeIds: string[]): Pick<NodeType, 'id' | 'type' | 'data'>[];
//# sourceMappingURL=useNodesData.d.ts.map