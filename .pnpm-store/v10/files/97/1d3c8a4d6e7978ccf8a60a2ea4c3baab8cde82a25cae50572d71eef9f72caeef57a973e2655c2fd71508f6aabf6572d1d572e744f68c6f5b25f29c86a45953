import type { Transform, XYPosition, SnapGrid, Dimensions, Handle } from '../types';
export type GetPointerPositionParams = {
    transform: Transform;
    snapGrid?: SnapGrid;
    snapToGrid?: boolean;
    containerBounds: DOMRect | null;
};
export declare function getPointerPosition(event: MouseEvent | TouchEvent, { snapGrid, snapToGrid, transform, containerBounds }: GetPointerPositionParams): XYPosition & {
    xSnapped: number;
    ySnapped: number;
};
export declare const getDimensions: (node: HTMLDivElement) => Dimensions;
export declare const getHostForElement: (element: HTMLElement | EventTarget | null) => Document | ShadowRoot;
export declare function isInputDOMNode(event: KeyboardEvent): boolean;
export declare const isMouseEvent: (event: MouseEvent | TouchEvent) => event is MouseEvent;
export declare const getEventPosition: (event: MouseEvent | TouchEvent, bounds?: DOMRect) => {
    x: number;
    y: number;
};
export declare const getHandleBounds: (type: "source" | "target", nodeElement: HTMLDivElement, nodeBounds: DOMRect, zoom: number, nodeId: string) => Handle[] | null;
//# sourceMappingURL=dom.d.ts.map