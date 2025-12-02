import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OutputItemImageGenerationCall } from "./outputitemimagegenerationcall.js";
import { OutputMessage } from "./outputmessage.js";
import { ResponseInputAudio } from "./responseinputaudio.js";
import { ResponseInputFile } from "./responseinputfile.js";
import { ResponseInputImage } from "./responseinputimage.js";
import { ResponseInputText } from "./responseinputtext.js";
import { ToolCallStatus } from "./toolcallstatus.js";
export declare const OpenAIResponsesInputTypeFunctionCall: {
    readonly FunctionCall: "function_call";
};
export type OpenAIResponsesInputTypeFunctionCall = ClosedEnum<typeof OpenAIResponsesInputTypeFunctionCall>;
export type OpenAIResponsesInputFunctionCall = {
    type: OpenAIResponsesInputTypeFunctionCall;
    callId: string;
    name: string;
    arguments: string;
    id?: string | undefined;
    status?: ToolCallStatus | null | undefined;
};
export declare const OpenAIResponsesInputTypeFunctionCallOutput: {
    readonly FunctionCallOutput: "function_call_output";
};
export type OpenAIResponsesInputTypeFunctionCallOutput = ClosedEnum<typeof OpenAIResponsesInputTypeFunctionCallOutput>;
export type OpenAIResponsesInputFunctionCallOutput = {
    type: OpenAIResponsesInputTypeFunctionCallOutput;
    id?: string | null | undefined;
    callId: string;
    output: string;
    status?: ToolCallStatus | null | undefined;
};
export declare const OpenAIResponsesInputTypeMessage2: {
    readonly Message: "message";
};
export type OpenAIResponsesInputTypeMessage2 = ClosedEnum<typeof OpenAIResponsesInputTypeMessage2>;
export declare const OpenAIResponsesInputRoleDeveloper2: {
    readonly Developer: "developer";
};
export type OpenAIResponsesInputRoleDeveloper2 = ClosedEnum<typeof OpenAIResponsesInputRoleDeveloper2>;
export declare const OpenAIResponsesInputRoleSystem2: {
    readonly System: "system";
};
export type OpenAIResponsesInputRoleSystem2 = ClosedEnum<typeof OpenAIResponsesInputRoleSystem2>;
export declare const OpenAIResponsesInputRoleUser2: {
    readonly User: "user";
};
export type OpenAIResponsesInputRoleUser2 = ClosedEnum<typeof OpenAIResponsesInputRoleUser2>;
export type OpenAIResponsesInputRoleUnion2 = OpenAIResponsesInputRoleUser2 | OpenAIResponsesInputRoleSystem2 | OpenAIResponsesInputRoleDeveloper2;
export type OpenAIResponsesInputContent3 = (ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
});
export type OpenAIResponsesInputMessage2 = {
    id: string;
    type?: OpenAIResponsesInputTypeMessage2 | undefined;
    role: OpenAIResponsesInputRoleUser2 | OpenAIResponsesInputRoleSystem2 | OpenAIResponsesInputRoleDeveloper2;
    content: Array<(ResponseInputText & {
        type: "input_text";
    }) | (ResponseInputImage & {
        type: "input_image";
    }) | (ResponseInputAudio & {
        type: "input_audio";
    }) | (ResponseInputFile & {
        type: "input_file";
    })>;
};
export declare const OpenAIResponsesInputTypeMessage1: {
    readonly Message: "message";
};
export type OpenAIResponsesInputTypeMessage1 = ClosedEnum<typeof OpenAIResponsesInputTypeMessage1>;
export declare const OpenAIResponsesInputRoleDeveloper1: {
    readonly Developer: "developer";
};
export type OpenAIResponsesInputRoleDeveloper1 = ClosedEnum<typeof OpenAIResponsesInputRoleDeveloper1>;
export declare const OpenAIResponsesInputRoleAssistant: {
    readonly Assistant: "assistant";
};
export type OpenAIResponsesInputRoleAssistant = ClosedEnum<typeof OpenAIResponsesInputRoleAssistant>;
export declare const OpenAIResponsesInputRoleSystem1: {
    readonly System: "system";
};
export type OpenAIResponsesInputRoleSystem1 = ClosedEnum<typeof OpenAIResponsesInputRoleSystem1>;
export declare const OpenAIResponsesInputRoleUser1: {
    readonly User: "user";
};
export type OpenAIResponsesInputRoleUser1 = ClosedEnum<typeof OpenAIResponsesInputRoleUser1>;
export type OpenAIResponsesInputRoleUnion1 = OpenAIResponsesInputRoleUser1 | OpenAIResponsesInputRoleSystem1 | OpenAIResponsesInputRoleAssistant | OpenAIResponsesInputRoleDeveloper1;
export type OpenAIResponsesInputContent1 = (ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
});
export type OpenAIResponsesInputContent2 = Array<(ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
})> | string;
export type OpenAIResponsesInputMessage1 = {
    type?: OpenAIResponsesInputTypeMessage1 | undefined;
    role: OpenAIResponsesInputRoleUser1 | OpenAIResponsesInputRoleSystem1 | OpenAIResponsesInputRoleAssistant | OpenAIResponsesInputRoleDeveloper1;
    content: Array<(ResponseInputText & {
        type: "input_text";
    }) | (ResponseInputImage & {
        type: "input_image";
    }) | (ResponseInputAudio & {
        type: "input_audio";
    }) | (ResponseInputFile & {
        type: "input_file";
    })> | string;
};
export type OpenAIResponsesInputUnion1 = OpenAIResponsesInputFunctionCall | OutputMessage | OpenAIResponsesInputMessage2 | OpenAIResponsesInputFunctionCallOutput | OutputItemImageGenerationCall | OpenAIResponsesInputMessage1;
export type OpenAIResponsesInputUnion = string | Array<OpenAIResponsesInputFunctionCall | OutputMessage | OpenAIResponsesInputMessage2 | OpenAIResponsesInputFunctionCallOutput | OutputItemImageGenerationCall | OpenAIResponsesInputMessage1> | any;
/** @internal */
export declare const OpenAIResponsesInputTypeFunctionCall$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputTypeFunctionCall>;
/** @internal */
export declare const OpenAIResponsesInputFunctionCall$inboundSchema: z.ZodType<OpenAIResponsesInputFunctionCall, unknown>;
export declare function openAIResponsesInputFunctionCallFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputFunctionCall, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputTypeFunctionCallOutput$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputTypeFunctionCallOutput>;
/** @internal */
export declare const OpenAIResponsesInputFunctionCallOutput$inboundSchema: z.ZodType<OpenAIResponsesInputFunctionCallOutput, unknown>;
export declare function openAIResponsesInputFunctionCallOutputFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputFunctionCallOutput, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputTypeMessage2$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputTypeMessage2>;
/** @internal */
export declare const OpenAIResponsesInputRoleDeveloper2$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleDeveloper2>;
/** @internal */
export declare const OpenAIResponsesInputRoleSystem2$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleSystem2>;
/** @internal */
export declare const OpenAIResponsesInputRoleUser2$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleUser2>;
/** @internal */
export declare const OpenAIResponsesInputRoleUnion2$inboundSchema: z.ZodType<OpenAIResponsesInputRoleUnion2, unknown>;
export declare function openAIResponsesInputRoleUnion2FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputRoleUnion2, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputContent3$inboundSchema: z.ZodType<OpenAIResponsesInputContent3, unknown>;
export declare function openAIResponsesInputContent3FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputContent3, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputMessage2$inboundSchema: z.ZodType<OpenAIResponsesInputMessage2, unknown>;
export declare function openAIResponsesInputMessage2FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputMessage2, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputTypeMessage1$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputTypeMessage1>;
/** @internal */
export declare const OpenAIResponsesInputRoleDeveloper1$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleDeveloper1>;
/** @internal */
export declare const OpenAIResponsesInputRoleAssistant$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleAssistant>;
/** @internal */
export declare const OpenAIResponsesInputRoleSystem1$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleSystem1>;
/** @internal */
export declare const OpenAIResponsesInputRoleUser1$inboundSchema: z.ZodEnum<typeof OpenAIResponsesInputRoleUser1>;
/** @internal */
export declare const OpenAIResponsesInputRoleUnion1$inboundSchema: z.ZodType<OpenAIResponsesInputRoleUnion1, unknown>;
export declare function openAIResponsesInputRoleUnion1FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputRoleUnion1, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputContent1$inboundSchema: z.ZodType<OpenAIResponsesInputContent1, unknown>;
export declare function openAIResponsesInputContent1FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputContent1, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputContent2$inboundSchema: z.ZodType<OpenAIResponsesInputContent2, unknown>;
export declare function openAIResponsesInputContent2FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputContent2, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputMessage1$inboundSchema: z.ZodType<OpenAIResponsesInputMessage1, unknown>;
export declare function openAIResponsesInputMessage1FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputMessage1, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputUnion1$inboundSchema: z.ZodType<OpenAIResponsesInputUnion1, unknown>;
export declare function openAIResponsesInputUnion1FromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputUnion1, SDKValidationError>;
/** @internal */
export declare const OpenAIResponsesInputUnion$inboundSchema: z.ZodType<OpenAIResponsesInputUnion, unknown>;
export declare function openAIResponsesInputUnionFromJSON(jsonString: string): SafeParseResult<OpenAIResponsesInputUnion, SDKValidationError>;
//# sourceMappingURL=openairesponsesinputunion.d.ts.map