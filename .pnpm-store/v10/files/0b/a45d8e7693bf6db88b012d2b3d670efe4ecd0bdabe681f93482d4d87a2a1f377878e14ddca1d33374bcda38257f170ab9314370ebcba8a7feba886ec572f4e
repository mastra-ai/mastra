import type { Delta } from "../types.js";
import Context from "./context.js";
declare class PatchContext extends Context<unknown> {
    left: unknown;
    delta: Delta;
    pipe: "patch";
    nested?: boolean;
    constructor(left: unknown, delta: Delta);
}
export default PatchContext;
