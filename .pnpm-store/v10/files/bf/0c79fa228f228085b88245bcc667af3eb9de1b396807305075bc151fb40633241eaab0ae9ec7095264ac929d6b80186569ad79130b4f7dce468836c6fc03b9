import { Position } from '../../types';
export type GetBezierPathParams = {
    /** The `x` position of the source handle. */
    sourceX: number;
    /** The `y` position of the source handle. */
    sourceY: number;
    /**
     * The position of the source handle.
     * @default Position.Bottom
     */
    sourcePosition?: Position;
    /** The `x` position of the target handle. */
    targetX: number;
    /** The `y` position of the target handle. */
    targetY: number;
    /**
     * The position of the target handle.
     * @default Position.Top
     */
    targetPosition?: Position;
    /**
     * The curvature of the bezier edge.
     * @default 0.25
     */
    curvature?: number;
};
export type GetControlWithCurvatureParams = {
    pos: Position;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    c: number;
};
export declare function getBezierEdgeCenter({ sourceX, sourceY, targetX, targetY, sourceControlX, sourceControlY, targetControlX, targetControlY, }: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourceControlX: number;
    sourceControlY: number;
    targetControlX: number;
    targetControlY: number;
}): [number, number, number, number];
/**
 * The `getBezierPath` util returns everything you need to render a bezier edge
 *between two nodes.
 * @public
 * @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
 * and `offsetX`, `offsetY` between source handle and label.
 * - `path`: the path to use in an SVG `<path>` element.
 * - `labelX`: the `x` position you can use to render a label for this edge.
 * - `labelY`: the `y` position you can use to render a label for this edge.
 * - `offsetX`: the absolute difference between the source `x` position and the `x` position of the
 * middle of this path.
 * - `offsetY`: the absolute difference between the source `y` position and the `y` position of the
 * middle of this path.
 * @example
 * ```js
 *  const source = { x: 0, y: 20 };
 *  const target = { x: 150, y: 100 };
 *
 *  const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
 *    sourceX: source.x,
 *    sourceY: source.y,
 *    sourcePosition: Position.Right,
 *    targetX: target.x,
 *    targetY: target.y,
 *    targetPosition: Position.Left,
 *});
 *```
 *
 * @remarks This function returns a tuple (aka a fixed-size array) to make it easier to
 *work with multiple edge paths at once.
 */
export declare function getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature, }: GetBezierPathParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number];
//# sourceMappingURL=bezier-edge.d.ts.map