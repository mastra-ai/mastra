import type { Delta } from "../types.js";
import Context from "./context.js";
declare class DiffContext extends Context<Delta> {
    left: unknown;
    right: unknown;
    pipe: "diff";
    leftType?: string;
    rightType?: string;
    leftIsArray?: boolean;
    rightIsArray?: boolean;
    constructor(left: unknown, right: unknown);
    prepareDeltaResult<T extends Delta>(result: T): T;
    setResult(result: Delta): this;
}
export default DiffContext;
