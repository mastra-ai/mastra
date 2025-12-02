import type { diff_match_patch } from "@dmsnell/diff-match-patch";
import type Context from "./contexts/context.js";
import type DiffContext from "./contexts/diff.js";
export interface Options {
    objectHash?: (item: object, index?: number) => string | undefined;
    matchByPosition?: boolean;
    arrays?: {
        detectMove?: boolean;
        includeValueOnMove?: boolean;
    };
    textDiff?: {
        diffMatchPatch: typeof diff_match_patch;
        minLength?: number;
    };
    propertyFilter?: (name: string, context: DiffContext) => boolean;
    cloneDiffValues?: boolean | ((value: unknown) => unknown);
    omitRemovedValues?: boolean;
}
export type AddedDelta = [unknown];
export type ModifiedDelta = [unknown, unknown];
export type DeletedDelta = [unknown, 0, 0];
export interface ObjectDelta {
    [property: string]: Delta;
}
export interface ArrayDelta {
    _t: "a";
    [index: number | `${number}`]: Delta;
    [index: `_${number}`]: DeletedDelta | MovedDelta;
}
export type MovedDelta = [unknown, number, 3];
export type TextDiffDelta = [string, 0, 2];
export type Delta = AddedDelta | ModifiedDelta | DeletedDelta | ObjectDelta | ArrayDelta | MovedDelta | TextDiffDelta | undefined;
export interface Filter<TContext extends Context<unknown>> {
    (context: TContext): void;
    filterName: string;
}
export declare function isAddedDelta(delta: Delta): delta is AddedDelta;
export declare function isModifiedDelta(delta: Delta): delta is ModifiedDelta;
export declare function isDeletedDelta(delta: Delta): delta is DeletedDelta;
export declare function isObjectDelta(delta: Delta): delta is ObjectDelta;
export declare function isArrayDelta(delta: Delta): delta is ArrayDelta;
export declare function isMovedDelta(delta: Delta): delta is MovedDelta;
export declare function isTextDiffDelta(delta: Delta): delta is TextDiffDelta;
