import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { ResponseInputAudio, ResponseInputAudio$Outbound } from "./responseinputaudio.js";
import { ResponseInputFile, ResponseInputFile$Outbound } from "./responseinputfile.js";
import { ResponseInputImage, ResponseInputImage$Outbound } from "./responseinputimage.js";
import { ResponseInputText, ResponseInputText$Outbound } from "./responseinputtext.js";
export declare const OpenResponsesEasyInputMessageType: {
    readonly Message: "message";
};
export type OpenResponsesEasyInputMessageType = ClosedEnum<typeof OpenResponsesEasyInputMessageType>;
export declare const OpenResponsesEasyInputMessageRoleDeveloper: {
    readonly Developer: "developer";
};
export type OpenResponsesEasyInputMessageRoleDeveloper = ClosedEnum<typeof OpenResponsesEasyInputMessageRoleDeveloper>;
export declare const OpenResponsesEasyInputMessageRoleAssistant: {
    readonly Assistant: "assistant";
};
export type OpenResponsesEasyInputMessageRoleAssistant = ClosedEnum<typeof OpenResponsesEasyInputMessageRoleAssistant>;
export declare const OpenResponsesEasyInputMessageRoleSystem: {
    readonly System: "system";
};
export type OpenResponsesEasyInputMessageRoleSystem = ClosedEnum<typeof OpenResponsesEasyInputMessageRoleSystem>;
export declare const OpenResponsesEasyInputMessageRoleUser: {
    readonly User: "user";
};
export type OpenResponsesEasyInputMessageRoleUser = ClosedEnum<typeof OpenResponsesEasyInputMessageRoleUser>;
export type OpenResponsesEasyInputMessageRoleUnion = OpenResponsesEasyInputMessageRoleUser | OpenResponsesEasyInputMessageRoleSystem | OpenResponsesEasyInputMessageRoleAssistant | OpenResponsesEasyInputMessageRoleDeveloper;
export type OpenResponsesEasyInputMessageContent1 = (ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
});
export type OpenResponsesEasyInputMessageContent2 = Array<(ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
})> | string;
export type OpenResponsesEasyInputMessage = {
    type?: OpenResponsesEasyInputMessageType | undefined;
    role: OpenResponsesEasyInputMessageRoleUser | OpenResponsesEasyInputMessageRoleSystem | OpenResponsesEasyInputMessageRoleAssistant | OpenResponsesEasyInputMessageRoleDeveloper;
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
/** @internal */
export declare const OpenResponsesEasyInputMessageType$outboundSchema: z.ZodEnum<typeof OpenResponsesEasyInputMessageType>;
/** @internal */
export declare const OpenResponsesEasyInputMessageRoleDeveloper$outboundSchema: z.ZodEnum<typeof OpenResponsesEasyInputMessageRoleDeveloper>;
/** @internal */
export declare const OpenResponsesEasyInputMessageRoleAssistant$outboundSchema: z.ZodEnum<typeof OpenResponsesEasyInputMessageRoleAssistant>;
/** @internal */
export declare const OpenResponsesEasyInputMessageRoleSystem$outboundSchema: z.ZodEnum<typeof OpenResponsesEasyInputMessageRoleSystem>;
/** @internal */
export declare const OpenResponsesEasyInputMessageRoleUser$outboundSchema: z.ZodEnum<typeof OpenResponsesEasyInputMessageRoleUser>;
/** @internal */
export type OpenResponsesEasyInputMessageRoleUnion$Outbound = string | string | string | string;
/** @internal */
export declare const OpenResponsesEasyInputMessageRoleUnion$outboundSchema: z.ZodType<OpenResponsesEasyInputMessageRoleUnion$Outbound, OpenResponsesEasyInputMessageRoleUnion>;
export declare function openResponsesEasyInputMessageRoleUnionToJSON(openResponsesEasyInputMessageRoleUnion: OpenResponsesEasyInputMessageRoleUnion): string;
/** @internal */
export type OpenResponsesEasyInputMessageContent1$Outbound = (ResponseInputText$Outbound & {
    type: "input_text";
}) | (ResponseInputImage$Outbound & {
    type: "input_image";
}) | (ResponseInputAudio$Outbound & {
    type: "input_audio";
}) | (ResponseInputFile$Outbound & {
    type: "input_file";
});
/** @internal */
export declare const OpenResponsesEasyInputMessageContent1$outboundSchema: z.ZodType<OpenResponsesEasyInputMessageContent1$Outbound, OpenResponsesEasyInputMessageContent1>;
export declare function openResponsesEasyInputMessageContent1ToJSON(openResponsesEasyInputMessageContent1: OpenResponsesEasyInputMessageContent1): string;
/** @internal */
export type OpenResponsesEasyInputMessageContent2$Outbound = Array<(ResponseInputText$Outbound & {
    type: "input_text";
}) | (ResponseInputImage$Outbound & {
    type: "input_image";
}) | (ResponseInputAudio$Outbound & {
    type: "input_audio";
}) | (ResponseInputFile$Outbound & {
    type: "input_file";
})> | string;
/** @internal */
export declare const OpenResponsesEasyInputMessageContent2$outboundSchema: z.ZodType<OpenResponsesEasyInputMessageContent2$Outbound, OpenResponsesEasyInputMessageContent2>;
export declare function openResponsesEasyInputMessageContent2ToJSON(openResponsesEasyInputMessageContent2: OpenResponsesEasyInputMessageContent2): string;
/** @internal */
export type OpenResponsesEasyInputMessage$Outbound = {
    type?: string | undefined;
    role: string | string | string | string;
    content: Array<(ResponseInputText$Outbound & {
        type: "input_text";
    }) | (ResponseInputImage$Outbound & {
        type: "input_image";
    }) | (ResponseInputAudio$Outbound & {
        type: "input_audio";
    }) | (ResponseInputFile$Outbound & {
        type: "input_file";
    })> | string;
};
/** @internal */
export declare const OpenResponsesEasyInputMessage$outboundSchema: z.ZodType<OpenResponsesEasyInputMessage$Outbound, OpenResponsesEasyInputMessage>;
export declare function openResponsesEasyInputMessageToJSON(openResponsesEasyInputMessage: OpenResponsesEasyInputMessage): string;
//# sourceMappingURL=openresponseseasyinputmessage.d.ts.map