import { type NodeDragItem, type XYPosition, InternalNodeBase, NodeBase, NodeLookup, SnapGrid } from '../types';
export declare function isParentSelected<NodeType extends NodeBase>(node: NodeType, nodeLookup: NodeLookup): boolean;
export declare function hasSelector(target: Element | EventTarget | null, selector: string, domNode: Element): boolean;
export declare function getDragItems<NodeType extends NodeBase>(nodeLookup: Map<string, InternalNodeBase<NodeType>>, nodesDraggable: boolean, mousePos: XYPosition, nodeId?: string): Map<string, NodeDragItem>;
export declare function getEventHandlerParams<NodeType extends InternalNodeBase>({ nodeId, dragItems, nodeLookup, dragging, }: {
    nodeId?: string;
    dragItems: Map<string, NodeDragItem>;
    nodeLookup: Map<string, NodeType>;
    dragging?: boolean;
}): [NodeBase, NodeBase[]];
/**
 * If a selection is being dragged we want to apply the same snap offset to all nodes in the selection.
 * This function calculates the snap offset based on the first node in the selection.
 */
export declare function calculateSnapOffset({ dragItems, snapGrid, x, y, }: {
    dragItems: Map<string, NodeDragItem>;
    snapGrid: SnapGrid;
    x: number;
    y: number;
}): {
    x: number;
    y: number;
} | null;
//# sourceMappingURL=utils.d.ts.map