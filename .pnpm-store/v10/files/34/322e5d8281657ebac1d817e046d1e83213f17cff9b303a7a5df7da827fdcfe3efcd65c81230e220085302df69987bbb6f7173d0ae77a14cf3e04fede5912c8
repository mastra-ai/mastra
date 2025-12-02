import { assertArrayHasAtLeast2 } from "../assertions/arrays.js";
class BaseFormatter {
    format(delta, left) {
        const context = {};
        this.prepareContext(context);
        const preparedContext = context;
        this.recurse(preparedContext, delta, left);
        return this.finalize(preparedContext);
    }
    prepareContext(context) {
        context.buffer = [];
        context.out = function (...args) {
            if (!this.buffer) {
                throw new Error("context buffer is not initialized");
            }
            this.buffer.push(...args);
        };
    }
    typeFormattterNotFound(_context, deltaType) {
        throw new Error(`cannot format delta type: ${deltaType}`);
    }
    /* eslint-disable @typescript-eslint/no-unused-vars */
    typeFormattterErrorFormatter(_context, _err, _delta, _leftValue, _key, _leftKey, _movedFrom) {
        // do nothing by default
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
    finalize({ buffer }) {
        if (Array.isArray(buffer)) {
            return buffer.join("");
        }
        return "";
    }
    recurse(context, delta, left, key, leftKey, movedFrom, isLast) {
        const useMoveOriginHere = delta && movedFrom;
        const leftValue = useMoveOriginHere ? movedFrom.value : left;
        if (typeof delta === "undefined" && typeof key === "undefined") {
            return undefined;
        }
        const type = this.getDeltaType(delta, movedFrom);
        const nodeType = type === "node"
            ? delta._t === "a"
                ? "array"
                : "object"
            : "";
        if (typeof key !== "undefined") {
            this.nodeBegin(context, key, leftKey, type, nodeType, isLast !== null && isLast !== void 0 ? isLast : false);
        }
        else {
            this.rootBegin(context, type, nodeType);
        }
        let typeFormattter;
        try {
            typeFormattter =
                type !== "unknown"
                    ? this[`format_${type}`]
                    : this.typeFormattterNotFound(context, type);
            typeFormattter.call(this, context, delta, leftValue, key, leftKey, movedFrom);
        }
        catch (err) {
            this.typeFormattterErrorFormatter(context, err, delta, leftValue, key, leftKey, movedFrom);
            if (typeof console !== "undefined" && console.error) {
                console.error(err.stack);
            }
        }
        if (typeof key !== "undefined") {
            this.nodeEnd(context, key, leftKey, type, nodeType, isLast !== null && isLast !== void 0 ? isLast : false);
        }
        else {
            this.rootEnd(context, type, nodeType);
        }
    }
    formatDeltaChildren(context, delta, left) {
        this.forEachDeltaKey(delta, left, (key, leftKey, movedFrom, isLast) => {
            this.recurse(context, delta[key], left ? left[leftKey] : undefined, key, leftKey, movedFrom, isLast);
        });
    }
    forEachDeltaKey(delta, left, fn) {
        const keys = [];
        const arrayKeys = delta._t === "a";
        if (!arrayKeys) {
            // it's an object delta
            const deltaKeys = Object.keys(delta);
            // if left is provided, push all keys from it first, in the original order
            if (typeof left === "object" && left !== null) {
                keys.push(...Object.keys(left));
            }
            // then add new keys from delta, to the bottom
            for (const key of deltaKeys) {
                if (keys.indexOf(key) >= 0)
                    continue;
                keys.push(key);
            }
            for (let index = 0; index < keys.length; index++) {
                const key = keys[index];
                if (key === undefined)
                    continue;
                const isLast = index === keys.length - 1;
                fn(
                // for object diff, the delta key and left key are the same
                key, key, 
                // there's no "move" in object diff
                undefined, isLast);
            }
            return;
        }
        // it's an array delta, this is a bit trickier because of position changes
        const movedFrom = {};
        for (const key in delta) {
            if (Object.prototype.hasOwnProperty.call(delta, key)) {
                const value = delta[key];
                if (Array.isArray(value) && value[2] === 3) {
                    const movedDelta = value;
                    movedFrom[movedDelta[1]] = Number.parseInt(key.substring(1));
                }
            }
        }
        // go thru the array positions, finding delta keys on the way
        const arrayDelta = delta;
        let leftIndex = 0;
        let rightIndex = 0;
        const leftArray = Array.isArray(left) ? left : undefined;
        const leftLength = leftArray
            ? leftArray.length
            : // if we don't have the original array,
                // use a length that ensures we'll go thru all delta keys
                Object.keys(arrayDelta).reduce((max, key) => {
                    if (key === "_t")
                        return max;
                    const isLeftKey = key.substring(0, 1) === "_";
                    if (isLeftKey) {
                        const itemDelta = arrayDelta[key];
                        const leftIndex = Number.parseInt(key.substring(1));
                        const rightIndex = Array.isArray(itemDelta) &&
                            itemDelta.length >= 3 &&
                            itemDelta[2] === 3
                            ? itemDelta[1]
                            : undefined;
                        const maxIndex = Math.max(leftIndex, rightIndex !== null && rightIndex !== void 0 ? rightIndex : 0);
                        return maxIndex > max ? maxIndex : max;
                    }
                    const rightIndex = Number.parseInt(key);
                    const leftIndex = movedFrom[rightIndex];
                    const maxIndex = Math.max(leftIndex !== null && leftIndex !== void 0 ? leftIndex : 0, rightIndex !== null && rightIndex !== void 0 ? rightIndex : 0);
                    return maxIndex > max ? maxIndex : max;
                }, 0) + 1;
        let rightLength = leftLength;
        // call fn with previous args, to catch last call and set isLast=true
        let previousFnArgs;
        const addKey = (...args) => {
            if (previousFnArgs) {
                fn(...previousFnArgs);
            }
            previousFnArgs = args;
        };
        const flushLastKey = () => {
            if (!previousFnArgs) {
                return;
            }
            fn(previousFnArgs[0], previousFnArgs[1], previousFnArgs[2], true);
        };
        while (leftIndex < leftLength ||
            rightIndex < rightLength ||
            `${rightIndex}` in arrayDelta) {
            let hasDelta = false;
            const leftIndexKey = `_${leftIndex}`;
            const rightIndexKey = `${rightIndex}`;
            const movedFromIndex = rightIndex in movedFrom ? movedFrom[rightIndex] : undefined;
            if (leftIndexKey in arrayDelta) {
                // something happened to the left item at this position
                hasDelta = true;
                const itemDelta = arrayDelta[leftIndexKey];
                addKey(leftIndexKey, movedFromIndex !== null && movedFromIndex !== void 0 ? movedFromIndex : leftIndex, movedFromIndex
                    ? {
                        key: `_${movedFromIndex}`,
                        value: leftArray ? leftArray[movedFromIndex] : undefined,
                    }
                    : undefined, false);
                if (Array.isArray(itemDelta)) {
                    if (itemDelta[2] === 0) {
                        // deleted
                        rightLength--;
                        leftIndex++;
                    }
                    else if (itemDelta[2] === 3) {
                        // left item moved somewhere else
                        leftIndex++;
                    }
                    else {
                        // unrecognized change to left item
                        leftIndex++;
                    }
                }
                else {
                    // unrecognized change to left item
                    leftIndex++;
                }
            }
            if (rightIndexKey in arrayDelta) {
                // something happened to the right item at this position
                hasDelta = true;
                const itemDelta = arrayDelta[rightIndexKey];
                const isItemAdded = Array.isArray(itemDelta) && itemDelta.length === 1;
                addKey(rightIndexKey, movedFromIndex !== null && movedFromIndex !== void 0 ? movedFromIndex : leftIndex, movedFromIndex
                    ? {
                        key: `_${movedFromIndex}`,
                        value: leftArray ? leftArray[movedFromIndex] : undefined,
                    }
                    : undefined, false);
                if (isItemAdded) {
                    // added
                    rightLength++;
                    rightIndex++;
                }
                else if (movedFromIndex === undefined) {
                    // modified (replace/object/array/textdiff)
                    leftIndex++;
                    rightIndex++;
                }
                else {
                    // move
                    rightIndex++;
                }
            }
            if (!hasDelta) {
                // left and right items are the same (unchanged)
                if ((leftArray && movedFromIndex === undefined) ||
                    this.includeMoveDestinations !== false) {
                    // show unchanged items only if we have the left array
                    addKey(rightIndexKey, movedFromIndex !== null && movedFromIndex !== void 0 ? movedFromIndex : leftIndex, movedFromIndex
                        ? {
                            key: `_${movedFromIndex}`,
                            value: leftArray ? leftArray[movedFromIndex] : undefined,
                        }
                        : undefined, false);
                }
                if (movedFromIndex !== undefined) {
                    // item at the right came from another position
                    rightIndex++;
                    // don't skip left item yet
                }
                else {
                    leftIndex++;
                    rightIndex++;
                }
            }
        }
        flushLastKey();
    }
    getDeltaType(delta, movedFrom) {
        if (typeof delta === "undefined") {
            if (typeof movedFrom !== "undefined") {
                return "movedestination";
            }
            return "unchanged";
        }
        if (Array.isArray(delta)) {
            if (delta.length === 1) {
                return "added";
            }
            if (delta.length === 2) {
                return "modified";
            }
            if (delta.length === 3 && delta[2] === 0) {
                return "deleted";
            }
            if (delta.length === 3 && delta[2] === 2) {
                return "textdiff";
            }
            if (delta.length === 3 && delta[2] === 3) {
                return "moved";
            }
        }
        else if (typeof delta === "object") {
            return "node";
        }
        return "unknown";
    }
    parseTextDiff(value) {
        var _a;
        const output = [];
        const lines = value.split("\n@@ ");
        for (const line of lines) {
            const lineOutput = {
                pieces: [],
            };
            const location = (_a = /^(?:@@ )?[-+]?(\d+),(\d+)/.exec(line)) === null || _a === void 0 ? void 0 : _a.slice(1);
            if (!location) {
                throw new Error("invalid text diff format");
            }
            assertArrayHasAtLeast2(location);
            lineOutput.location = {
                line: location[0],
                chr: location[1],
            };
            const pieces = line.split("\n").slice(1);
            for (let pieceIndex = 0, piecesLength = pieces.length; pieceIndex < piecesLength; pieceIndex++) {
                const piece = pieces[pieceIndex];
                if (piece === undefined || !piece.length) {
                    continue;
                }
                const pieceOutput = {
                    type: "context",
                };
                if (piece.substring(0, 1) === "+") {
                    pieceOutput.type = "added";
                }
                else if (piece.substring(0, 1) === "-") {
                    pieceOutput.type = "deleted";
                }
                pieceOutput.text = piece.slice(1);
                lineOutput.pieces.push(pieceOutput);
            }
            output.push(lineOutput);
        }
        return output;
    }
}
export default BaseFormatter;
