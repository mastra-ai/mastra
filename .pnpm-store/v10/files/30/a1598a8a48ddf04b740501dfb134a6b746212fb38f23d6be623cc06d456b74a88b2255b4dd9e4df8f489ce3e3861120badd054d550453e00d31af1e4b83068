import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
import { OpenAIResponsesRefusalContent } from "./openairesponsesrefusalcontent.js";
import { ResponseOutputText } from "./responseoutputtext.js";
export declare const OutputMessageRole: {
    readonly Assistant: "assistant";
};
export type OutputMessageRole = ClosedEnum<typeof OutputMessageRole>;
export declare const OutputMessageType: {
    readonly Message: "message";
};
export type OutputMessageType = ClosedEnum<typeof OutputMessageType>;
export declare const OutputMessageStatusInProgress: {
    readonly InProgress: "in_progress";
};
export type OutputMessageStatusInProgress = ClosedEnum<typeof OutputMessageStatusInProgress>;
export declare const OutputMessageStatusIncomplete: {
    readonly Incomplete: "incomplete";
};
export type OutputMessageStatusIncomplete = ClosedEnum<typeof OutputMessageStatusIncomplete>;
export declare const OutputMessageStatusCompleted: {
    readonly Completed: "completed";
};
export type OutputMessageStatusCompleted = ClosedEnum<typeof OutputMessageStatusCompleted>;
export type OutputMessageStatusUnion = OutputMessageStatusCompleted | OutputMessageStatusIncomplete | OutputMessageStatusInProgress;
export type OutputMessageContent = ResponseOutputText | OpenAIResponsesRefusalContent;
export type OutputMessage = {
    id: string;
    role: OutputMessageRole;
    type: OutputMessageType;
    status?: OutputMessageStatusCompleted | OutputMessageStatusIncomplete | OutputMessageStatusInProgress | undefined;
    content: Array<ResponseOutputText | OpenAIResponsesRefusalContent>;
};
/** @internal */
export declare const OutputMessageRole$inboundSchema: z.ZodEnum<typeof OutputMessageRole>;
/** @internal */
export declare const OutputMessageType$inboundSchema: z.ZodEnum<typeof OutputMessageType>;
/** @internal */
export declare const OutputMessageStatusInProgress$inboundSchema: z.ZodEnum<typeof OutputMessageStatusInProgress>;
/** @internal */
export declare const OutputMessageStatusIncomplete$inboundSchema: z.ZodEnum<typeof OutputMessageStatusIncomplete>;
/** @internal */
export declare const OutputMessageStatusCompleted$inboundSchema: z.ZodEnum<typeof OutputMessageStatusCompleted>;
/** @internal */
export declare const OutputMessageStatusUnion$inboundSchema: z.ZodType<OutputMessageStatusUnion, unknown>;
export declare function outputMessageStatusUnionFromJSON(jsonString: string): SafeParseResult<OutputMessageStatusUnion, SDKValidationError>;
/** @internal */
export declare const OutputMessageContent$inboundSchema: z.ZodType<OutputMessageContent, unknown>;
export declare function outputMessageContentFromJSON(jsonString: string): SafeParseResult<OutputMessageContent, SDKValidationError>;
/** @internal */
export declare const OutputMessage$inboundSchema: z.ZodType<OutputMessage, unknown>;
export declare function outputMessageFromJSON(jsonString: string): SafeParseResult<OutputMessage, SDKValidationError>;
//# sourceMappingURL=outputmessage.d.ts.map