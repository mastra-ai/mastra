import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesRefusalContent, OpenAIResponsesRefusalContent$Outbound } from "./openairesponsesrefusalcontent.js";
import { ResponseOutputText, ResponseOutputText$Outbound } from "./responseoutputtext.js";
export declare const ResponsesOutputMessageRole: {
    readonly Assistant: "assistant";
};
export type ResponsesOutputMessageRole = ClosedEnum<typeof ResponsesOutputMessageRole>;
export declare const ResponsesOutputMessageType: {
    readonly Message: "message";
};
export type ResponsesOutputMessageType = ClosedEnum<typeof ResponsesOutputMessageType>;
export declare const ResponsesOutputMessageStatusInProgress: {
    readonly InProgress: "in_progress";
};
export type ResponsesOutputMessageStatusInProgress = ClosedEnum<typeof ResponsesOutputMessageStatusInProgress>;
export declare const ResponsesOutputMessageStatusIncomplete: {
    readonly Incomplete: "incomplete";
};
export type ResponsesOutputMessageStatusIncomplete = ClosedEnum<typeof ResponsesOutputMessageStatusIncomplete>;
export declare const ResponsesOutputMessageStatusCompleted: {
    readonly Completed: "completed";
};
export type ResponsesOutputMessageStatusCompleted = ClosedEnum<typeof ResponsesOutputMessageStatusCompleted>;
export type ResponsesOutputMessageStatusUnion = ResponsesOutputMessageStatusCompleted | ResponsesOutputMessageStatusIncomplete | ResponsesOutputMessageStatusInProgress;
export type ResponsesOutputMessageContent = ResponseOutputText | OpenAIResponsesRefusalContent;
/**
 * An output message item
 */
export type ResponsesOutputMessage = {
    id: string;
    role: ResponsesOutputMessageRole;
    type: ResponsesOutputMessageType;
    status?: ResponsesOutputMessageStatusCompleted | ResponsesOutputMessageStatusIncomplete | ResponsesOutputMessageStatusInProgress | undefined;
    content: Array<ResponseOutputText | OpenAIResponsesRefusalContent>;
};
/** @internal */
export declare const ResponsesOutputMessageRole$inboundSchema: z.ZodEnum<typeof ResponsesOutputMessageRole>;
/** @internal */
export declare const ResponsesOutputMessageRole$outboundSchema: z.ZodEnum<typeof ResponsesOutputMessageRole>;
/** @internal */
export declare const ResponsesOutputMessageType$inboundSchema: z.ZodEnum<typeof ResponsesOutputMessageType>;
/** @internal */
export declare const ResponsesOutputMessageType$outboundSchema: z.ZodEnum<typeof ResponsesOutputMessageType>;
/** @internal */
export declare const ResponsesOutputMessageStatusInProgress$inboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusInProgress>;
/** @internal */
export declare const ResponsesOutputMessageStatusInProgress$outboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusInProgress>;
/** @internal */
export declare const ResponsesOutputMessageStatusIncomplete$inboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputMessageStatusIncomplete$outboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusIncomplete>;
/** @internal */
export declare const ResponsesOutputMessageStatusCompleted$inboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusCompleted>;
/** @internal */
export declare const ResponsesOutputMessageStatusCompleted$outboundSchema: z.ZodEnum<typeof ResponsesOutputMessageStatusCompleted>;
/** @internal */
export declare const ResponsesOutputMessageStatusUnion$inboundSchema: z.ZodType<ResponsesOutputMessageStatusUnion, unknown>;
/** @internal */
export type ResponsesOutputMessageStatusUnion$Outbound = string | string | string;
/** @internal */
export declare const ResponsesOutputMessageStatusUnion$outboundSchema: z.ZodType<ResponsesOutputMessageStatusUnion$Outbound, ResponsesOutputMessageStatusUnion>;
export declare function responsesOutputMessageStatusUnionToJSON(responsesOutputMessageStatusUnion: ResponsesOutputMessageStatusUnion): string;
export declare function responsesOutputMessageStatusUnionFromJSON(jsonString: string): SafeParseResult<ResponsesOutputMessageStatusUnion, SDKValidationError>;
/** @internal */
export declare const ResponsesOutputMessageContent$inboundSchema: z.ZodType<ResponsesOutputMessageContent, unknown>;
/** @internal */
export type ResponsesOutputMessageContent$Outbound = ResponseOutputText$Outbound | OpenAIResponsesRefusalContent$Outbound;
/** @internal */
export declare const ResponsesOutputMessageContent$outboundSchema: z.ZodType<ResponsesOutputMessageContent$Outbound, ResponsesOutputMessageContent>;
export declare function responsesOutputMessageContentToJSON(responsesOutputMessageContent: ResponsesOutputMessageContent): string;
export declare function responsesOutputMessageContentFromJSON(jsonString: string): SafeParseResult<ResponsesOutputMessageContent, SDKValidationError>;
/** @internal */
export declare const ResponsesOutputMessage$inboundSchema: z.ZodType<ResponsesOutputMessage, unknown>;
/** @internal */
export type ResponsesOutputMessage$Outbound = {
    id: string;
    role: string;
    type: string;
    status?: string | string | string | undefined;
    content: Array<ResponseOutputText$Outbound | OpenAIResponsesRefusalContent$Outbound>;
};
/** @internal */
export declare const ResponsesOutputMessage$outboundSchema: z.ZodType<ResponsesOutputMessage$Outbound, ResponsesOutputMessage>;
export declare function responsesOutputMessageToJSON(responsesOutputMessage: ResponsesOutputMessage): string;
export declare function responsesOutputMessageFromJSON(jsonString: string): SafeParseResult<ResponsesOutputMessage, SDKValidationError>;
//# sourceMappingURL=responsesoutputmessage.d.ts.map