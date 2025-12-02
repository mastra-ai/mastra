type Move = {
    from: number;
    to: number;
};
type IndexDelta = {
    from: number;
    to: number;
};
/**
 * returns a set of moves (move array item from an index to another index) that,
 * if applied sequentially to an array,
 * achieves the index delta provided (item at index "from" ends up in index "to").
 *
 * This is essential in translation jsondiffpatch array moves to JSONPatch move ops.
 */
export declare const moveOpsFromPositionDeltas: (indexDelta: IndexDelta[]) => Move[];
export {};
