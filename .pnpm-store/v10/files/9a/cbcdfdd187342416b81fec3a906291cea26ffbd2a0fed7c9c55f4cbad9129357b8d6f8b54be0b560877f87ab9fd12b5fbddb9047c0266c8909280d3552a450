import { type NodeConnection, type HandleType, type HandleConnection } from '@xyflow/system';
type UseNodeConnectionsParams = {
    /** ID of the node, filled in automatically if used inside custom node. */
    id?: string;
    /** What type of handle connections do you want to observe? */
    handleType?: HandleType;
    /** Filter by handle id (this is only needed if the node has multiple handles of the same type). */
    handleId?: string;
    /** Gets called when a connection is established. */
    onConnect?: (connections: HandleConnection[]) => void;
    /** Gets called when a connection is removed. */
    onDisconnect?: (connections: HandleConnection[]) => void;
};
/**
 * This hook returns an array of connections on a specific node, handle type ('source', 'target') or handle ID.
 *
 * @public
 * @returns An array with connections.
 *
 * @example
 * ```jsx
 *import { useNodeConnections } from '@xyflow/react';
 *
 *export default function () {
 *  const connections = useNodeConnections({
 *    handleType: 'target',
 *    handleId: 'my-handle',
 *  });
 *
 *  return (
 *    <div>There are currently {connections.length} incoming connections!</div>
 *  );
 *}
 *```
 */
export declare function useNodeConnections({ id, handleType, handleId, onConnect, onDisconnect, }?: UseNodeConnectionsParams): NodeConnection[];
export {};
//# sourceMappingURL=useNodeConnections.d.ts.map