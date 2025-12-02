import { NodeBase, CoordinateExtent, InternalNodeUpdate, NodeOrigin, PanZoomInstance, Transform, XYPosition, ConnectionLookup, EdgeBase, EdgeLookup, InternalNodeBase, NodeLookup, NodeDimensionChange, NodePositionChange, ParentLookup } from '../types';
import { ParentExpandChild } from './types';
export declare function updateAbsolutePositions<NodeType extends NodeBase>(nodeLookup: NodeLookup<InternalNodeBase<NodeType>>, parentLookup: ParentLookup<InternalNodeBase<NodeType>>, options?: UpdateNodesOptions<NodeType>): void;
type UpdateNodesOptions<NodeType extends NodeBase> = {
    nodeOrigin?: NodeOrigin;
    nodeExtent?: CoordinateExtent;
    elevateNodesOnSelect?: boolean;
    defaults?: Partial<NodeType>;
    checkEquality?: boolean;
};
export declare function adoptUserNodes<NodeType extends NodeBase>(nodes: NodeType[], nodeLookup: NodeLookup<InternalNodeBase<NodeType>>, parentLookup: ParentLookup<InternalNodeBase<NodeType>>, options?: UpdateNodesOptions<NodeType>): boolean;
export declare function handleExpandParent(children: ParentExpandChild[], nodeLookup: NodeLookup, parentLookup: ParentLookup, nodeOrigin?: NodeOrigin): (NodeDimensionChange | NodePositionChange)[];
export declare function updateNodeInternals<NodeType extends InternalNodeBase>(updates: Map<string, InternalNodeUpdate>, nodeLookup: NodeLookup<NodeType>, parentLookup: ParentLookup<NodeType>, domNode: HTMLElement | null, nodeOrigin?: NodeOrigin, nodeExtent?: CoordinateExtent): {
    changes: (NodeDimensionChange | NodePositionChange)[];
    updatedInternals: boolean;
};
export declare function panBy({ delta, panZoom, transform, translateExtent, width, height, }: {
    delta: XYPosition;
    panZoom: PanZoomInstance | null;
    transform: Transform;
    translateExtent: CoordinateExtent;
    width: number;
    height: number;
}): Promise<boolean>;
export declare function updateConnectionLookup(connectionLookup: ConnectionLookup, edgeLookup: EdgeLookup, edges: EdgeBase[]): void;
export {};
//# sourceMappingURL=store.d.ts.map