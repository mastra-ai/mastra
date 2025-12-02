import { ReadonlyJSONValue } from "../../utils/json/json-value";
declare const TOOL_RESPONSE_SYMBOL: unique symbol;
export type ToolResponseLike<TResult> = {
    result: TResult;
    artifact?: ReadonlyJSONValue | undefined;
    isError?: boolean | undefined;
};
export declare class ToolResponse<TResult> {
    get [TOOL_RESPONSE_SYMBOL](): boolean;
    readonly artifact?: ReadonlyJSONValue;
    readonly result: TResult;
    readonly isError: boolean;
    constructor(options: ToolResponseLike<TResult>);
    static [Symbol.hasInstance](obj: unknown): obj is ToolResponse<ReadonlyJSONValue>;
    static toResponse(result: any | ToolResponse<any>): ToolResponse<any>;
}
export {};
//# sourceMappingURL=ToolResponse.d.ts.map