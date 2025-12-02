import { diff_match_patch } from "@dmsnell/diff-match-patch";
import dateReviver from "./date-reviver.js";
import DiffPatcher from "./diffpatcher.js";
export { dateReviver, DiffPatcher };
export function create(options) {
    return new DiffPatcher(Object.assign(Object.assign({}, options), { textDiff: Object.assign(Object.assign({}, options === null || options === void 0 ? void 0 : options.textDiff), { diffMatchPatch: diff_match_patch }) }));
}
let defaultInstance;
export function diff(left, right) {
    if (!defaultInstance) {
        defaultInstance = new DiffPatcher({
            textDiff: { diffMatchPatch: diff_match_patch },
        });
    }
    return defaultInstance.diff(left, right);
}
export function patch(left, delta) {
    if (!defaultInstance) {
        defaultInstance = new DiffPatcher({
            textDiff: { diffMatchPatch: diff_match_patch },
        });
    }
    return defaultInstance.patch(left, delta);
}
export function unpatch(right, delta) {
    if (!defaultInstance) {
        defaultInstance = new DiffPatcher({
            textDiff: { diffMatchPatch: diff_match_patch },
        });
    }
    return defaultInstance.unpatch(right, delta);
}
export function reverse(delta) {
    if (!defaultInstance) {
        defaultInstance = new DiffPatcher({
            textDiff: { diffMatchPatch: diff_match_patch },
        });
    }
    return defaultInstance.reverse(delta);
}
export function clone(value) {
    if (!defaultInstance) {
        defaultInstance = new DiffPatcher({
            textDiff: { diffMatchPatch: diff_match_patch },
        });
    }
    return defaultInstance.clone(value);
}
