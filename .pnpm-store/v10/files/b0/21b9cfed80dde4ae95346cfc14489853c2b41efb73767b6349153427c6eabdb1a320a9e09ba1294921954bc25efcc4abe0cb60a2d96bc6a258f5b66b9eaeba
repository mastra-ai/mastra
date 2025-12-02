import type { Dimensions, XYPosition, CoordinateExtent, Box, Rect, NodeBase, NodeOrigin, SnapGrid, Transform, InternalNodeBase, NodeLookup, Padding } from '../types';
import { type Viewport } from '../types';
import { type AriaLabelConfig } from '../constants';
export declare const clamp: (val: number, min?: number, max?: number) => number;
export declare const clampPosition: (position: XYPosition | undefined, extent: CoordinateExtent, dimensions: Partial<Dimensions>) => {
    x: number;
    y: number;
};
export declare function clampPositionToParent<NodeType extends NodeBase>(childPosition: XYPosition, childDimensions: Dimensions, parent: InternalNodeBase<NodeType>): {
    x: number;
    y: number;
};
export declare const calcAutoPan: (pos: XYPosition, bounds: Dimensions, speed?: number, distance?: number) => number[];
export declare const getBoundsOfBoxes: (box1: Box, box2: Box) => Box;
export declare const rectToBox: ({ x, y, width, height }: Rect) => Box;
export declare const boxToRect: ({ x, y, x2, y2 }: Box) => Rect;
export declare const nodeToRect: (node: InternalNodeBase | NodeBase, nodeOrigin?: NodeOrigin) => Rect;
export declare const nodeToBox: (node: InternalNodeBase | NodeBase, nodeOrigin?: NodeOrigin) => Box;
export declare const getBoundsOfRects: (rect1: Rect, rect2: Rect) => Rect;
export declare const getOverlappingArea: (rectA: Rect, rectB: Rect) => number;
export declare const isRectObject: (obj: any) => obj is Rect;
export declare const isNumeric: (n: any) => n is number;
export declare const devWarn: (id: string, message: string) => void;
export declare const snapPosition: (position: XYPosition, snapGrid?: SnapGrid) => XYPosition;
export declare const pointToRendererPoint: ({ x, y }: XYPosition, [tx, ty, tScale]: Transform, snapToGrid?: boolean, snapGrid?: SnapGrid) => XYPosition;
export declare const rendererPointToPoint: ({ x, y }: XYPosition, [tx, ty, tScale]: Transform) => XYPosition;
/**
 * Returns a viewport that encloses the given bounds with padding.
 * @public
 * @remarks You can determine bounds of nodes with {@link getNodesBounds} and {@link getBoundsOfRects}
 * @param bounds - Bounds to fit inside viewport.
 * @param width - Width of the viewport.
 * @param height  - Height of the viewport.
 * @param minZoom - Minimum zoom level of the resulting viewport.
 * @param maxZoom - Maximum zoom level of the resulting viewport.
 * @param padding - Padding around the bounds.
 * @returns A transformed {@link Viewport} that encloses the given bounds which you can pass to e.g. {@link setViewport}.
 * @example
 * const { x, y, zoom } = getViewportForBounds(
 * { x: 0, y: 0, width: 100, height: 100},
 * 1200, 800, 0.5, 2);
 */
export declare const getViewportForBounds: (bounds: Rect, width: number, height: number, minZoom: number, maxZoom: number, padding: Padding) => Viewport;
export declare const isMacOs: () => boolean;
export declare function isCoordinateExtent(extent?: CoordinateExtent | 'parent' | null): extent is CoordinateExtent;
export declare function getNodeDimensions(node: {
    measured?: {
        width?: number;
        height?: number;
    };
    width?: number;
    height?: number;
    initialWidth?: number;
    initialHeight?: number;
}): {
    width: number;
    height: number;
};
export declare function nodeHasDimensions<NodeType extends NodeBase = NodeBase>(node: NodeType): boolean;
/**
 * Convert child position to aboslute position
 *
 * @internal
 * @param position
 * @param parentId
 * @param nodeLookup
 * @param nodeOrigin
 * @returns an internal node with an absolute position
 */
export declare function evaluateAbsolutePosition(position: XYPosition, dimensions: {
    width?: number;
    height?: number;
} | undefined, parentId: string, nodeLookup: NodeLookup, nodeOrigin: NodeOrigin): XYPosition;
export declare function areSetsEqual(a: Set<string>, b: Set<string>): boolean;
/**
 * Polyfill for Promise.withResolvers until we can use it in all browsers
 * @internal
 */
export declare function withResolvers<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};
export declare function mergeAriaLabelConfig(partial?: Partial<AriaLabelConfig>): AriaLabelConfig;
//# sourceMappingURL=general.d.ts.map