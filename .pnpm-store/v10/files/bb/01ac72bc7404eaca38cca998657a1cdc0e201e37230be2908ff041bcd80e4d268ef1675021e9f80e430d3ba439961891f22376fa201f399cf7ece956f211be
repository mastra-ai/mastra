import * as z from "zod/v4";
export type ToolDefinitionJsonFunction = {
    name: string;
    description?: string | undefined;
    parameters?: {
        [k: string]: any;
    } | undefined;
    strict?: boolean | null | undefined;
};
export type ToolDefinitionJson = {
    type: "function";
    function: ToolDefinitionJsonFunction;
};
/** @internal */
export type ToolDefinitionJsonFunction$Outbound = {
    name: string;
    description?: string | undefined;
    parameters?: {
        [k: string]: any;
    } | undefined;
    strict?: boolean | null | undefined;
};
/** @internal */
export declare const ToolDefinitionJsonFunction$outboundSchema: z.ZodType<ToolDefinitionJsonFunction$Outbound, ToolDefinitionJsonFunction>;
export declare function toolDefinitionJsonFunctionToJSON(toolDefinitionJsonFunction: ToolDefinitionJsonFunction): string;
/** @internal */
export type ToolDefinitionJson$Outbound = {
    type: "function";
    function: ToolDefinitionJsonFunction$Outbound;
};
/** @internal */
export declare const ToolDefinitionJson$outboundSchema: z.ZodType<ToolDefinitionJson$Outbound, ToolDefinitionJson>;
export declare function toolDefinitionJsonToJSON(toolDefinitionJson: ToolDefinitionJson): string;
//# sourceMappingURL=tooldefinitionjson.d.ts.map