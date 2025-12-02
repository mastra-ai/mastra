import defaultClone from "../clone.js";
import Context from "./context.js";
class DiffContext extends Context {
    constructor(left, right) {
        super();
        this.left = left;
        this.right = right;
        this.pipe = "diff";
    }
    prepareDeltaResult(result) {
        var _a, _b, _c, _d;
        if (typeof result === "object") {
            if (((_a = this.options) === null || _a === void 0 ? void 0 : _a.omitRemovedValues) &&
                Array.isArray(result) &&
                result.length > 1 &&
                (result.length === 2 || // modified
                    result[2] === 0 || // deleted
                    result[2] === 3) // moved
            ) {
                // omit the left/old value (this delta will be more compact but irreversible)
                result[0] = 0;
            }
            if ((_b = this.options) === null || _b === void 0 ? void 0 : _b.cloneDiffValues) {
                const clone = typeof ((_c = this.options) === null || _c === void 0 ? void 0 : _c.cloneDiffValues) === "function"
                    ? (_d = this.options) === null || _d === void 0 ? void 0 : _d.cloneDiffValues
                    : defaultClone;
                if (typeof result[0] === "object") {
                    result[0] = clone(result[0]);
                }
                if (typeof result[1] === "object") {
                    result[1] = clone(result[1]);
                }
            }
        }
        return result;
    }
    setResult(result) {
        this.prepareDeltaResult(result);
        return super.setResult(result);
    }
}
export default DiffContext;
