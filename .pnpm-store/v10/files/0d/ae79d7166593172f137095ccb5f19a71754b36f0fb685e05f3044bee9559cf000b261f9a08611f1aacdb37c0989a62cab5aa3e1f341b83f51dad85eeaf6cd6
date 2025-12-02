import type { Op } from "./jsonpatch.js";
export type JsonPatchOp = Op | {
    op: "copy";
    from: string;
    path: string;
} | {
    op: "test";
    path: string;
    value: unknown;
};
/**
 * an implementation of JSON-Patch (RFC 6902) apply.
 *
 * this is atomic (if any errors occur, a rollback is performed before return)
 *
 * Note: this is used for testing to ensure the JSON-Patch formatter output is correct
 *
 * @param target an object to patch (this object will be modified, clone first if you want to avoid mutation)
 * @param patch a JSON-Patch procuded by jsondiffpatch jsonpatch formatter
 * (this is a subset of the whole spec, supporting only add, remove, replace and move operations)
 * @returns
 */
export declare const applyJsonPatchRFC6902: (target: unknown, patch: JsonPatchOp[]) => void;
