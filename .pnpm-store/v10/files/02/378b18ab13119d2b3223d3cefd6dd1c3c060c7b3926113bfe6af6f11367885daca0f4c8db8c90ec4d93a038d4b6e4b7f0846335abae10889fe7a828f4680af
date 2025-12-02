import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { ResponseInputFile, ResponseInputFile$Outbound } from "./responseinputfile.js";
import { ResponseInputImage, ResponseInputImage$Outbound } from "./responseinputimage.js";
import { ResponseInputText, ResponseInputText$Outbound } from "./responseinputtext.js";
export type Variables = ResponseInputText | ResponseInputImage | ResponseInputFile | string;
export type OpenAIResponsesPrompt = {
    id: string;
    variables?: {
        [k: string]: ResponseInputText | ResponseInputImage | ResponseInputFile | string;
    } | null | undefined;
};
/** @internal */
export declare const Variables$inboundSchema: z.ZodType<Variables, unknown>;
/** @internal */
export type Variables$Outbound = ResponseInputText$Outbound | ResponseInputImage$Outbound | ResponseInputFile$Outbound | string;
/** @internal */
export declare const Variables$outboundSchema: z.ZodType<Variables$Outbound, Variables>;
export declare function variablesToJSON(variables: Variables): string;
export declare function variablesFromJSON(jsonString: string): SafeParseResult<Variables, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesPrompt$inboundSchema: z.ZodType<OpenAIResponsesPrompt, unknown>;
/** @internal */
export type OpenAIResponsesPrompt$Outbound = {
    id: string;
    variables?: {
        [k: string]: ResponseInputText$Outbound | ResponseInputImage$Outbound | ResponseInputFile$Outbound | string;
    } | null | undefined;
};
/** @internal */
export declare const OpenAIResponsesPrompt$outboundSchema: z.ZodType<OpenAIResponsesPrompt$Outbound, OpenAIResponsesPrompt>;
export declare function openAIResponsesPromptToJSON(openAIResponsesPrompt: OpenAIResponsesPrompt): string;
export declare function openAIResponsesPromptFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesPrompt, SDKValidationError>;
//# sourceMappingURL=openairesponsesprompt.d.ts.map