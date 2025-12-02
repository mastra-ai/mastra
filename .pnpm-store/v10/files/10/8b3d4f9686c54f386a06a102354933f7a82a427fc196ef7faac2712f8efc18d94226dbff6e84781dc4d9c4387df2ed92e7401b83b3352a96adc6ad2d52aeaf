import { Value } from "../../values/index.js";
/**
 * The result of running a function on the server.
 *
 * If the function hit an exception it will have an `errorMessage`. Otherwise
 * it will produce a `Value`.
 *
 * @public
 */
export type FunctionResult = FunctionSuccess | FunctionFailure;
export type FunctionSuccess = {
    success: true;
    value: Value;
    logLines: string[];
};
export type FunctionFailure = {
    success: false;
    errorMessage: string;
    errorData?: Value | undefined;
    logLines: string[];
};
//# sourceMappingURL=function_result.d.ts.map