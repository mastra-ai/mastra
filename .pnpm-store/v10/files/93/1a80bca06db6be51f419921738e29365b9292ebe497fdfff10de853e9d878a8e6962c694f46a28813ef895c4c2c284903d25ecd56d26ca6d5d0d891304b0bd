import { Position } from '../../types';
export interface GetSmoothStepPathParams {
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
    /** @default 5 */
    borderRadius?: number;
    centerX?: number;
    centerY?: number;
    /** @default 20 */
    offset?: number;
    /**
     * Controls where the bend occurs along the path.
     * 0 = at source, 1 = at target, 0.5 = midpoint
     * @default 0.5
     */
    stepPosition?: number;
}
/**
 * The `getSmoothStepPath` util returns everything you need to render a stepped path
 * between two nodes. The `borderRadius` property can be used to choose how rounded
 * the corners of those steps are.
 * @public
 * @returns A path string you can use in an SVG, the `labelX` and `labelY` position (center of path)
 * and `offsetX`, `offsetY` between source handle and label.
 *
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
 *  const [path, labelX, labelY, offsetX, offsetY] = getSmoothStepPath({
 *    sourceX: source.x,
 *    sourceY: source.y,
 *    sourcePosition: Position.Right,
 *    targetX: target.x,
 *    targetY: target.y,
 *    targetPosition: Position.Left,
 *  });
 * ```
 * @remarks This function returns a tuple (aka a fixed-size array) to make it easier to work with multiple edge paths at once.
 */
export declare function getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius, centerX, centerY, offset, stepPosition, }: GetSmoothStepPathParams): [path: string, labelX: number, labelY: number, offsetX: number, offsetY: number];
//# sourceMappingURL=smoothstep-edge.d.ts.map