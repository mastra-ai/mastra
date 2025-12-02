declare function addUniqueItem<T>(arr: T[], item: T): void;
declare function removeItem<T>(arr: T[], item: T): void;
declare function moveItem<T>([...arr]: T[], fromIndex: number, toIndex: number): T[];

declare const clamp: (min: number, max: number, v: number) => number;

type DevMessage = (check: boolean, message: string, errorCode?: string) => void;
declare let warning: DevMessage;
declare let invariant: DevMessage;

declare const MotionGlobalConfig: {
    skipAnimations?: boolean;
    instantAnimations?: boolean;
    useManualTiming?: boolean;
    WillChange?: any;
    mix?: <T>(a: T, b: T) => (p: number) => T;
};

/**
 * Check if value is a numerical string, ie a string that is purely a number eg "100" or "-100.1"
 */
declare const isNumericalString: (v: string) => boolean;

declare function isObject(value: unknown): value is object;

/**
 * Check if the value is a zero value string like "0px" or "0%"
 */
declare const isZeroValueString: (v: string) => boolean;

declare function memo<T extends any>(callback: () => T): () => T;

declare const noop: <T>(any: T) => T;

declare const pipe: (...transformers: Function[]) => Function;

declare const progress: (from: number, to: number, value: number) => number;

type GenericHandler = (...args: any) => void;
declare class SubscriptionManager<Handler extends GenericHandler> {
    private subscriptions;
    add(handler: Handler): VoidFunction;
    notify(a?: Parameters<Handler>[0], b?: Parameters<Handler>[1], c?: Parameters<Handler>[2]): void;
    getSize(): number;
    clear(): void;
}

/**
 * Converts seconds to milliseconds
 *
 * @param seconds - Time in seconds.
 * @return milliseconds - Converted time in milliseconds.
 */
declare const secondsToMilliseconds: (seconds: number) => number;
declare const millisecondsToSeconds: (milliseconds: number) => number;

declare function velocityPerSecond(velocity: number, frameDuration: number): number;

declare function hasWarned(message: string): boolean;
declare function warnOnce(condition: boolean, message: string, errorCode?: string): void;

declare const wrap: (min: number, max: number, v: number) => number;

declare const anticipate: (p: number) => number;

declare const backOut: (t: number) => number;
declare const backIn: EasingFunction;
declare const backInOut: EasingFunction;

type EasingFunction = (v: number) => number;
type EasingModifier = (easing: EasingFunction) => EasingFunction;
type BezierDefinition = readonly [number, number, number, number];
type EasingDefinition = BezierDefinition | "linear" | "easeIn" | "easeOut" | "easeInOut" | "circIn" | "circOut" | "circInOut" | "backIn" | "backOut" | "backInOut" | "anticipate";
/**
 * The easing function to use. Set as one of:
 *
 * - The name of an in-built easing function.
 * - An array of four numbers to define a cubic bezier curve.
 * - An easing function, that accepts and returns a progress value between `0` and `1`.
 *
 * @public
 */
type Easing = EasingDefinition | EasingFunction;

declare const circIn: EasingFunction;
declare const circOut: EasingFunction;
declare const circInOut: EasingFunction;

declare function cubicBezier(mX1: number, mY1: number, mX2: number, mY2: number): (t: number) => number;

declare const easeIn: (t: number) => number;
declare const easeOut: (t: number) => number;
declare const easeInOut: (t: number) => number;

declare const mirrorEasing: EasingModifier;

declare const reverseEasing: EasingModifier;

type Direction = "start" | "end";
declare function steps(numSteps: number, direction?: Direction): EasingFunction;

declare function getEasingForSegment(easing: Easing | Easing[], i: number): Easing;

declare const isBezierDefinition: (easing: Easing | Easing[]) => easing is BezierDefinition;

declare const isEasingArray: (ease: any) => ease is Easing[];

declare const easingDefinitionToFunction: (definition: Easing) => EasingFunction;

interface Point {
    x: number;
    y: number;
}
interface Axis {
    min: number;
    max: number;
}
interface Box {
    x: Axis;
    y: Axis;
}
interface BoundingBox {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
interface AxisDelta {
    translate: number;
    scale: number;
    origin: number;
    originPoint: number;
}
interface Delta {
    x: AxisDelta;
    y: AxisDelta;
}
type TransformPoint = (point: Point) => Point;

export { type Axis, type AxisDelta, type BezierDefinition, type BoundingBox, type Box, type Delta, type DevMessage, type Direction, type Easing, type EasingDefinition, type EasingFunction, type EasingModifier, MotionGlobalConfig, type Point, SubscriptionManager, type TransformPoint, addUniqueItem, anticipate, backIn, backInOut, backOut, circIn, circInOut, circOut, clamp, cubicBezier, easeIn, easeInOut, easeOut, easingDefinitionToFunction, getEasingForSegment, hasWarned, invariant, isBezierDefinition, isEasingArray, isNumericalString, isObject, isZeroValueString, memo, millisecondsToSeconds, mirrorEasing, moveItem, noop, pipe, progress, removeItem, reverseEasing, secondsToMilliseconds, steps, velocityPerSecond, warnOnce, warning, wrap };
