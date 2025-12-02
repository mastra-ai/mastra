import { moveOpsFromPositionDeltas } from "../moves/delta-to-sequence.js";
import { applyJsonPatchRFC6902 } from "./jsonpatch-apply.js";
const OPERATIONS = {
    add: "add",
    remove: "remove",
    replace: "replace",
    move: "move",
};
class JSONFormatter {
    format(delta) {
        const ops = [];
        const stack = [{ path: "", delta }];
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === undefined || !current.delta)
                break;
            if (Array.isArray(current.delta)) {
                // add
                if (current.delta.length === 1) {
                    ops.push({
                        op: OPERATIONS.add,
                        path: current.path,
                        value: current.delta[0],
                    });
                }
                // modify
                if (current.delta.length === 2) {
                    ops.push({
                        op: OPERATIONS.replace,
                        path: current.path,
                        value: current.delta[1],
                    });
                }
                // delete
                if (current.delta[2] === 0) {
                    ops.push({
                        op: OPERATIONS.remove,
                        path: current.path,
                    });
                }
                // text diff
                if (current.delta[2] === 2) {
                    throw new Error("JSONPatch (RFC 6902) doesn't support text diffs, disable textDiff option");
                }
            }
            else if (current.delta._t === "a") {
                // array delta
                const arrayDelta = current.delta;
                const deletes = [];
                // array index moves
                const indexDelta = [];
                const inserts = [];
                const updates = [];
                for (const key of Object.keys(arrayDelta)) {
                    if (key === "_t")
                        continue;
                    if (key.substring(0, 1) === "_") {
                        const index = Number.parseInt(key.substring(1));
                        const itemDelta = arrayDelta[key];
                        if (!itemDelta)
                            continue;
                        if (!Array.isArray(itemDelta)) {
                            updates.push({ to: index, delta: itemDelta });
                        }
                        else if (itemDelta.length === 3) {
                            if (itemDelta[2] === 3) {
                                indexDelta.push({ from: index, to: itemDelta[1] });
                            }
                            else if (itemDelta[2] === 0) {
                                deletes.push(index);
                            }
                        }
                    }
                    else {
                        const itemDelta = arrayDelta[key];
                        const index = Number.parseInt(key);
                        if (itemDelta) {
                            if (!Array.isArray(itemDelta)) {
                                updates.push({ to: index, delta: itemDelta });
                            }
                            else if (itemDelta.length === 1) {
                                inserts.push({ to: index, value: itemDelta[0] });
                            }
                            else if (itemDelta.length === 2) {
                                updates.push({ to: index, delta: itemDelta });
                            }
                            else if (itemDelta.length === 3) {
                                if (itemDelta[2] === 3) {
                                    throw new Error("JSONPatch (RFC 6902) doesn't support text diffs, disable textDiff option");
                                }
                            }
                        }
                    }
                }
                inserts.sort((a, b) => a.to - b.to);
                deletes.sort((a, b) => b - a);
                // delete operations (bottoms-up, so a delete doen't affect the following)
                for (const index of deletes) {
                    ops.push({
                        op: OPERATIONS.remove,
                        path: `${current.path}/${index}`,
                    });
                    if (indexDelta.length > 0) {
                        for (const move of indexDelta) {
                            if (index < move.from) {
                                move.from--;
                            }
                        }
                    }
                }
                if (indexDelta.length > 0) {
                    // adjust moves "to" to compensate for future inserts
                    // in reverse order (moves shift left in this loop, this avoids missing any insert)c
                    const insertsBottomsUp = [...inserts].reverse();
                    for (const insert of insertsBottomsUp) {
                        for (const move of indexDelta) {
                            if (insert.to < move.to) {
                                move.to--;
                            }
                        }
                    }
                    /**
                     * translate array index deltas (pairs of from/to) into JSONPatch,
                     * into a sequence of move operations.
                     */
                    const moveOps = moveOpsFromPositionDeltas(indexDelta);
                    for (const moveOp of moveOps) {
                        ops.push({
                            op: OPERATIONS.move,
                            from: `${current.path}/${moveOp.from}`,
                            path: `${current.path}/${moveOp.to}`,
                        });
                    }
                }
                // insert operations (top-bottom, so an insert doesn't affect the following)
                for (const insert of inserts) {
                    const { to, value } = insert;
                    ops.push({
                        op: OPERATIONS.add,
                        path: `${current.path}/${to}`,
                        value,
                    });
                }
                // update operations
                const stackUpdates = [];
                for (const update of updates) {
                    const { to, delta } = update;
                    if (Array.isArray(delta)) {
                        if (delta.length === 2) {
                            ops.push({
                                op: OPERATIONS.replace,
                                path: `${current.path}/${to}`,
                                value: delta[1],
                            });
                        }
                    }
                    else {
                        // nested delta (object or array)
                        stackUpdates.push({
                            path: `${current.path}/${to}`,
                            delta,
                        });
                    }
                }
                if (stackUpdates.length > 0) {
                    // push into the stack in reverse order to process them in original order
                    stack.push(...stackUpdates.reverse());
                }
            }
            else {
                // object delta
                // push into the stack in reverse order to process them in original order
                for (const key of Object.keys(current.delta).reverse()) {
                    const childDelta = current.delta[key];
                    stack.push({
                        path: `${current.path}/${formatPropertyNameForRFC6902(key)}`,
                        delta: childDelta,
                    });
                }
            }
        }
        return ops;
    }
}
export default JSONFormatter;
let defaultInstance;
export const format = (delta) => {
    if (!defaultInstance) {
        defaultInstance = new JSONFormatter();
    }
    return defaultInstance.format(delta);
};
export const log = (delta) => {
    console.log(format(delta));
};
const formatPropertyNameForRFC6902 = (path) => {
    // see https://datatracker.ietf.org/doc/html/rfc6902#appendix-A.14
    if (typeof path !== "string")
        return path.toString();
    if (path.indexOf("/") === -1 && path.indexOf("~") === -1)
        return path;
    return path.replace(/~/g, "~0").replace(/\//g, "~1");
};
// expose the standard JSONPatch apply too
export const patch = applyJsonPatchRFC6902;
