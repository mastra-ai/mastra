import { Connection, HandleConnection, HandleType } from '@xyflow/system';
type UseHandleConnectionsParams = {
    /** What type of handle connections do you want to observe? */
    type: HandleType;
    /** The handle id (this is only needed if the node has multiple handles of the same type). */
    id?: string | null;
    /** If node id is not provided, the node id from the `NodeIdContext` is used. */
    nodeId?: string;
    /** Gets called when a connection is established. */
    onConnect?: (connections: Connection[]) => void;
    /** Gets called when a connection is removed. */
    onDisconnect?: (connections: Connection[]) => void;
};
/**
 * Hook to check if a <Handle /> is connected to another <Handle /> and get the connections.
 *
 * @public
 * @deprecated Use `useNodeConnections` instead.
 * @returns An array with handle connections.
 */
export declare function useHandleConnections({ type, id, nodeId, onConnect, onDisconnect, }: UseHandleConnectionsParams): HandleConnection[];
export {};
//# sourceMappingURL=useHandleConnections.d.ts.map