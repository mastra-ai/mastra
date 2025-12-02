import { CoordinateExtent, NodeOrigin } from '../types';
import { getPointerPosition } from '../utils';
import { ControlPosition } from './types';
type GetResizeDirectionParams = {
    width: number;
    prevWidth: number;
    height: number;
    prevHeight: number;
    affectsX: boolean;
    affectsY: boolean;
};
/**
 * Get all connecting edges for a given set of nodes
 * @param width - new width of the node
 * @param prevWidth - previous width of the node
 * @param height - new height of the node
 * @param prevHeight - previous height of the node
 * @param affectsX - whether to invert the resize direction for the x axis
 * @param affectsY - whether to invert the resize direction for the y axis
 * @returns array of two numbers representing the direction of the resize for each axis, 0 = no change, 1 = increase, -1 = decrease
 */
export declare function getResizeDirection({ width, prevWidth, height, prevHeight, affectsX, affectsY, }: GetResizeDirectionParams): number[];
/**
 * Parses the control position that is being dragged to dimensions that are being resized
 * @param controlPosition - position of the control that is being dragged
 * @returns isHorizontal, isVertical, affectsX, affectsY,
 */
export declare function getControlDirection(controlPosition: ControlPosition): {
    isHorizontal: boolean;
    isVertical: boolean;
    affectsX: boolean;
    affectsY: boolean;
};
type PrevValues = {
    width: number;
    height: number;
    x: number;
    y: number;
};
type StartValues = PrevValues & {
    pointerX: number;
    pointerY: number;
    aspectRatio: number;
};
/**
 * Calculates new width & height and x & y of node after resize based on pointer position
 * @description - Buckle up, this is a chunky one... If you want to determine the new dimensions of a node after a resize,
 * you have to account for all possible restrictions: min/max width/height of the node, the maximum extent the node is allowed
 * to move in (in this case: resize into) determined by the parent node, the minimal extent determined by child nodes
 * with expandParent or extent: 'parent' set and oh yeah, these things also have to work with keepAspectRatio!
 * The way this is done is by determining how much each of these restricting actually restricts the resize and then applying the
 * strongest restriction. Because the resize affects x, y and width, height and width, height of a opposing side with keepAspectRatio,
 * the resize amount is always kept in distX & distY amount (the distance in mouse movement)
 * Instead of clamping each value, we first calculate the biggest 'clamp' (for the lack of a better name) and then apply it to all values.
 * To complicate things nodeOrigin has to be taken into account as well. This is done by offsetting the nodes as if their origin is [0, 0],
 * then calculating the restrictions as usual
 * @param startValues - starting values of resize
 * @param controlDirection - dimensions affected by the resize
 * @param pointerPosition - the current pointer position corrected for snapping
 * @param boundaries - minimum and maximum dimensions of the node
 * @param keepAspectRatio - prevent changes of asprect ratio
 * @returns x, y, width and height of the node after resize
 */
export declare function getDimensionsAfterResize(startValues: StartValues, controlDirection: ReturnType<typeof getControlDirection>, pointerPosition: ReturnType<typeof getPointerPosition>, boundaries: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
}, keepAspectRatio: boolean, nodeOrigin: NodeOrigin, extent?: CoordinateExtent, childExtent?: CoordinateExtent): {
    width: number;
    height: number;
    x: number;
    y: number;
};
export {};
//# sourceMappingURL=utils.d.ts.map