import { isArrayWithAtLeast2, isNonEmptyArray } from "../assertions/arrays.js";
/**
 * returns a set of moves (move array item from an index to another index) that,
 * if applied sequentially to an array,
 * achieves the index delta provided (item at index "from" ends up in index "to").
 *
 * This is essential in translation jsondiffpatch array moves to JSONPatch move ops.
 */
export const moveOpsFromPositionDeltas = (indexDelta) => {
    // moves that if applied sequentially (as in JSONPatch),
    // to an array achieve the position deltas provided (item at "from" ends up at index "to")
    const ops = [];
    const pendingDeltas = [...indexDelta];
    let extraMoveCount = 0;
    while (pendingDeltas.length > 0) {
        const { next, extra } = pickNextMove(pendingDeltas);
        if (next.from !== next.to) {
            ops.push({
                from: next.from,
                to: next.to,
            });
            // adjust future moves "from" according to my "from" and "to"
            for (const delta of pendingDeltas) {
                if (next.from === delta.from) {
                    throw new Error("trying to move the same item twice");
                }
                if (next.from < delta.from) {
                    delta.from--;
                }
                if (next.to <= delta.from) {
                    delta.from++;
                }
            }
        }
        if (extra) {
            extraMoveCount++;
            if (extraMoveCount > 100) {
                // this is a safety net, we should never get here if the moves are correct
                throw new Error("failed to apply all array moves");
            }
            // adding extra move (if the shift prediction succeeds, this move is skipped)
            pendingDeltas.push(extra);
        }
    }
    return ops;
};
const pickNextMove = (deltas) => {
    if (!isNonEmptyArray(deltas)) {
        throw new Error("no more moves to make");
    }
    if (!isArrayWithAtLeast2(deltas)) {
        // only 1 left, we're done!
        return { next: deltas.shift() };
    }
    /*
     * each move operation can shift the other "froms" (easy to correct),
     * and other "tos" (hard to correct).
     *
     * to avoid this, we try to find moves that are "final" and perform those first,
     * a "final" move is a move that will leave its item in the definition position.
     *
     * this happens for moves to an index that don't have any pending move from/to before, or after.
     * when performing such move, the items to the left (or right) of its "to" won't move anymore.
     *
     * when it's not possible to identify a "final" move, we take the first "from" and do that.
     * (hoping that will untangle and free a "final" move next)
     * we make a guess about how it will be shifted (by future moves),
     * and add an extra move to adjust later if needed.
     */
    // find the moves moving to the left/right extremes
    let leftmostTo = deltas[0];
    let leftmostToIndex = -1;
    let rightmostTo = deltas[0];
    let rightmostToIndex = -1;
    for (let i = 0; i < deltas.length; i++) {
        const move = deltas[i];
        if (!move)
            continue;
        if (leftmostToIndex < 0 || move.to < leftmostTo.to) {
            leftmostTo = move;
            leftmostToIndex = i;
        }
        if (rightmostToIndex < 0 || move.to > rightmostTo.to) {
            rightmostTo = move;
            rightmostToIndex = i;
        }
    }
    // find the moves moving from the left/right extremes (excluding the 2 above)
    let leftmostFrom = deltas[0];
    let leftmostFromIndex = -1;
    let rightmostFrom = deltas[0];
    let rightmostFromIndex = -1;
    for (let i = 0; i < deltas.length; i++) {
        const move = deltas[i];
        if (!move)
            continue;
        if (i !== leftmostToIndex &&
            (leftmostFromIndex < 0 || move.from < leftmostFrom.from)) {
            leftmostFrom = move;
            leftmostFromIndex = i;
        }
        if (i !== rightmostToIndex &&
            (rightmostFromIndex < 0 || move.from > rightmostFrom.from)) {
            rightmostFrom = move;
            rightmostFromIndex = i;
        }
    }
    if (leftmostFromIndex < 0 ||
        leftmostTo.to < leftmostFrom.from ||
        (leftmostTo.to < leftmostTo.from && leftmostTo.to === leftmostFrom.from)) {
        // nothing else will move to the left of leftmostTo,
        // it's a "final" move to the left
        const next = deltas.splice(leftmostToIndex, 1)[0];
        if (!next)
            throw new Error("failed to get next move");
        return { next };
    }
    if (rightmostFromIndex < 0 ||
        rightmostTo.to > rightmostFrom.from ||
        (rightmostTo.to > rightmostTo.from && rightmostTo.to === rightmostFrom.from)) {
        // nothing else will move to the right of rightmostTo,
        // it's a "final" move to the left
        const next = deltas.splice(rightmostToIndex, 1)[0];
        if (!next)
            throw new Error("failed to get next move");
        return { next };
    }
    // can't move anything to final location
    // use leftmostFrom move (trying to untangle)
    const move = deltas.splice(leftmostFromIndex, 1)[0];
    if (!move)
        throw new Error("failed to get next move");
    const futureShift = deltas.reduce((acc, m) => {
        return (acc +
            ((m.to < move.to
                ? // an insert to the left, shift to compensate
                    -1
                : 0) +
                (m.from < move.to
                    ? // an insert to the left, shift to compensate
                        1
                    : 0)));
    }, 0);
    const correctedTo = move.to + futureShift;
    return {
        next: {
            from: move.from,
            to: correctedTo,
        },
        //  add an extra move to adjust later (if this item doesn't end at the exact "to")
        extra: {
            from: correctedTo,
            to: move.to,
        },
    };
};
