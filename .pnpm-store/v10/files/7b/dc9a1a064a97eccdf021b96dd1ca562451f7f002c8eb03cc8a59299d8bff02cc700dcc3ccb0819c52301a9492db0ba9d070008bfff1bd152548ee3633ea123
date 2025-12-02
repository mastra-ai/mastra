/** @ignore */
type RangeLike = {
    length: number;
    stride?: number;
};
/** @ignore */
type ClampRangeThen<T extends RangeLike> = (source: T, offset: number, length: number) => any;
export declare function clampRange<T extends RangeLike>(source: T, begin: number | undefined, end: number | undefined): [number, number];
export declare function clampRange<T extends RangeLike, N extends ClampRangeThen<T> = ClampRangeThen<T>>(source: T, begin: number | undefined, end: number | undefined, then: N): ReturnType<N>;
/** @ignore */
export declare const wrapIndex: (index: number, len: number) => number;
/** @ignore */
export declare function createElementComparator(search: any): (value: any) => boolean;
export {};
