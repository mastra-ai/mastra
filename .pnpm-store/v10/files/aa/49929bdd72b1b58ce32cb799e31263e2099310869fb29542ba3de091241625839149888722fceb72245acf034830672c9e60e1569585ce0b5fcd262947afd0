import type { Delta } from "../types.js";
export interface AddOp {
    op: "add";
    path: string;
    value: unknown;
}
export interface RemoveOp {
    op: "remove";
    path: string;
}
export interface ReplaceOp {
    op: "replace";
    path: string;
    value: unknown;
}
export interface MoveOp {
    op: "move";
    from: string;
    path: string;
}
export type Op = AddOp | RemoveOp | ReplaceOp | MoveOp;
declare class JSONFormatter {
    format(delta: Delta): Op[];
}
export default JSONFormatter;
export declare const format: (delta: Delta) => Op[];
export declare const log: (delta: Delta) => void;
export declare const patch: (target: unknown, patch: import("./jsonpatch-apply.js").JsonPatchOp[]) => void;
