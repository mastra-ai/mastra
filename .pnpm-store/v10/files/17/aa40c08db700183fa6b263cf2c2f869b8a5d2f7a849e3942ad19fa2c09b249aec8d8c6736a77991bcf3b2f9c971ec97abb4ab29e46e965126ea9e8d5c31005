import type { NodeBase, NodeLookup, NodeOrigin, Transform, XYPosition } from '../types';
import type { OnResize, OnResizeEnd, OnResizeStart, ShouldResize, ControlPosition, ResizeControlDirection } from './types';
export type XYResizerChange = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};
export type XYResizerChildChange = {
    id: string;
    position: XYPosition;
    extent?: NodeBase['extent'];
};
type XYResizerParams = {
    domNode: HTMLDivElement;
    nodeId: string;
    getStoreItems: () => {
        nodeLookup: NodeLookup;
        transform: Transform;
        snapGrid?: [number, number];
        snapToGrid: boolean;
        nodeOrigin: NodeOrigin;
        paneDomNode: HTMLDivElement | null;
    };
    onChange: (changes: XYResizerChange, childChanges: XYResizerChildChange[]) => void;
    onEnd?: (change: Required<XYResizerChange>) => void;
};
type XYResizerUpdateParams = {
    controlPosition: ControlPosition;
    boundaries: {
        minWidth: number;
        minHeight: number;
        maxWidth: number;
        maxHeight: number;
    };
    keepAspectRatio: boolean;
    resizeDirection?: ResizeControlDirection;
    onResizeStart: OnResizeStart | undefined;
    onResize: OnResize | undefined;
    onResizeEnd: OnResizeEnd | undefined;
    shouldResize: ShouldResize | undefined;
};
export type XYResizerInstance = {
    update: (params: XYResizerUpdateParams) => void;
    destroy: () => void;
};
export declare function XYResizer({ domNode, nodeId, getStoreItems, onChange, onEnd }: XYResizerParams): XYResizerInstance;
export {};
//# sourceMappingURL=XYResizer.d.ts.map