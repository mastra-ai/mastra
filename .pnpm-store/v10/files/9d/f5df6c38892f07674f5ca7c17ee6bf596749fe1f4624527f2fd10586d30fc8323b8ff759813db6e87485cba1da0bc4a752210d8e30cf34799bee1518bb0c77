import { Connection, InternalNodeBase, Transform, EdgeBase } from '../..';
export declare function getEdgeCenter({ sourceX, sourceY, targetX, targetY, }: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
}): [number, number, number, number];
export type GetEdgeZIndexParams = {
    sourceNode: InternalNodeBase;
    targetNode: InternalNodeBase;
    selected?: boolean;
    zIndex?: number;
    elevateOnSelect?: boolean;
};
/**
 * Returns the z-index for an edge based on the node it connects and whether it is selected.
 * By default, edges are rendered below nodes. This behaviour is different for edges that are
 * connected to nodes with a parent, as they are rendered above the parent node.
 */
export declare function getElevatedEdgeZIndex({ sourceNode, targetNode, selected, zIndex, elevateOnSelect, }: GetEdgeZIndexParams): number;
type IsEdgeVisibleParams = {
    sourceNode: InternalNodeBase;
    targetNode: InternalNodeBase;
    width: number;
    height: number;
    transform: Transform;
};
export declare function isEdgeVisible({ sourceNode, targetNode, width, height, transform }: IsEdgeVisibleParams): boolean;
/**
 * This util is a convenience function to add a new Edge to an array of edges. It also performs some validation to make sure you don't add an invalid edge or duplicate an existing one.
 * @public
 * @param edgeParams - Either an `Edge` or a `Connection` you want to add.
 * @param edges - The array of all current edges.
 * @returns A new array of edges with the new edge added.
 *
 * @remarks If an edge with the same `target` and `source` already exists (and the same
 *`targetHandle` and `sourceHandle` if those are set), then this util won't add
 *a new edge even if the `id` property is different.
 *
 */
export declare const addEdge: <EdgeType extends EdgeBase>(edgeParams: EdgeType | Connection, edges: EdgeType[]) => EdgeType[];
export type ReconnectEdgeOptions = {
    /**
     * Should the id of the old edge be replaced with the new connection id.
     * @default true
     */
    shouldReplaceId?: boolean;
};
/**
 * A handy utility to update an existing [`Edge`](/api-reference/types/edge) with new properties.
 *This searches your edge array for an edge with a matching `id` and updates its
 *properties with the connection you provide.
 * @public
 * @param oldEdge - The edge you want to update.
 * @param newConnection - The new connection you want to update the edge with.
 * @param edges - The array of all current edges.
 * @returns The updated edges array.
 *
 * @example
 * ```js
 *const onReconnect = useCallback(
 *  (oldEdge: Edge, newConnection: Connection) => setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),[]);
 *```
 */
export declare const reconnectEdge: <EdgeType extends EdgeBase>(oldEdge: EdgeType, newConnection: Connection, edges: EdgeType[], options?: ReconnectEdgeOptions) => EdgeType[];
export {};
//# sourceMappingURL=general.d.ts.map