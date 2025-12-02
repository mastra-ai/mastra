import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { ResponseInputAudio, ResponseInputAudio$Outbound } from "./responseinputaudio.js";
import { ResponseInputFile, ResponseInputFile$Outbound } from "./responseinputfile.js";
import { ResponseInputImage, ResponseInputImage$Outbound } from "./responseinputimage.js";
import { ResponseInputText, ResponseInputText$Outbound } from "./responseinputtext.js";
export declare const OpenResponsesInputMessageItemType: {
    readonly Message: "message";
};
export type OpenResponsesInputMessageItemType = ClosedEnum<typeof OpenResponsesInputMessageItemType>;
export declare const OpenResponsesInputMessageItemRoleDeveloper: {
    readonly Developer: "developer";
};
export type OpenResponsesInputMessageItemRoleDeveloper = ClosedEnum<typeof OpenResponsesInputMessageItemRoleDeveloper>;
export declare const OpenResponsesInputMessageItemRoleSystem: {
    readonly System: "system";
};
export type OpenResponsesInputMessageItemRoleSystem = ClosedEnum<typeof OpenResponsesInputMessageItemRoleSystem>;
export declare const OpenResponsesInputMessageItemRoleUser: {
    readonly User: "user";
};
export type OpenResponsesInputMessageItemRoleUser = ClosedEnum<typeof OpenResponsesInputMessageItemRoleUser>;
export type OpenResponsesInputMessageItemRoleUnion = OpenResponsesInputMessageItemRoleUser | OpenResponsesInputMessageItemRoleSystem | OpenResponsesInputMessageItemRoleDeveloper;
export type OpenResponsesInputMessageItemContent = (ResponseInputText & {
    type: "input_text";
}) | (ResponseInputImage & {
    type: "input_image";
}) | (ResponseInputAudio & {
    type: "input_audio";
}) | (ResponseInputFile & {
    type: "input_file";
});
export type OpenResponsesInputMessageItem = {
    id?: string | undefined;
    type?: OpenResponsesInputMessageItemType | undefined;
    role: OpenResponsesInputMessageItemRoleUser | OpenResponsesInputMessageItemRoleSystem | OpenResponsesInputMessageItemRoleDeveloper;
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
/** @internal */
export declare const OpenResponsesInputMessageItemType$outboundSchema: z.ZodEnum<typeof OpenResponsesInputMessageItemType>;
/** @internal */
export declare const OpenResponsesInputMessageItemRoleDeveloper$outboundSchema: z.ZodEnum<typeof OpenResponsesInputMessageItemRoleDeveloper>;
/** @internal */
export declare const OpenResponsesInputMessageItemRoleSystem$outboundSchema: z.ZodEnum<typeof OpenResponsesInputMessageItemRoleSystem>;
/** @internal */
export declare const OpenResponsesInputMessageItemRoleUser$outboundSchema: z.ZodEnum<typeof OpenResponsesInputMessageItemRoleUser>;
/** @internal */
export type OpenResponsesInputMessageItemRoleUnion$Outbound = string | string | string;
/** @internal */
export declare const OpenResponsesInputMessageItemRoleUnion$outboundSchema: z.ZodType<OpenResponsesInputMessageItemRoleUnion$Outbound, OpenResponsesInputMessageItemRoleUnion>;
export declare function openResponsesInputMessageItemRoleUnionToJSON(openResponsesInputMessageItemRoleUnion: OpenResponsesInputMessageItemRoleUnion): string;
/** @internal */
export type OpenResponsesInputMessageItemContent$Outbound = (ResponseInputText$Outbound & {
    type: "input_text";
}) | (ResponseInputImage$Outbound & {
    type: "input_image";
}) | (ResponseInputAudio$Outbound & {
    type: "input_audio";
}) | (ResponseInputFile$Outbound & {
    type: "input_file";
});
/** @internal */
export declare const OpenResponsesInputMessageItemContent$outboundSchema: z.ZodType<OpenResponsesInputMessageItemContent$Outbound, OpenResponsesInputMessageItemContent>;
export declare function openResponsesInputMessageItemContentToJSON(openResponsesInputMessageItemContent: OpenResponsesInputMessageItemContent): string;
/** @internal */
export type OpenResponsesInputMessageItem$Outbound = {
    id?: string | undefined;
    type?: string | undefined;
    role: string | string | string;
    content: Array<(ResponseInputText$Outbound & {
        type: "input_text";
    }) | (ResponseInputImage$Outbound & {
        type: "input_image";
    }) | (ResponseInputAudio$Outbound & {
        type: "input_audio";
    }) | (ResponseInputFile$Outbound & {
        type: "input_file";
    })>;
};
/** @internal */
export declare const OpenResponsesInputMessageItem$outboundSchema: z.ZodType<OpenResponsesInputMessageItem$Outbound, OpenResponsesInputMessageItem>;
export declare function openResponsesInputMessageItemToJSON(openResponsesInputMessageItem: OpenResponsesInputMessageItem): string;
//# sourceMappingURL=openresponsesinputmessageitem.d.ts.map