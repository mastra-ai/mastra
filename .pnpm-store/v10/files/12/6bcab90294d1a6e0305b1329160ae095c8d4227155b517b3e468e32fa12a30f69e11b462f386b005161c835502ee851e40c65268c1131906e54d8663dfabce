import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export type FileT = {
    fileData: string;
    fileId?: string | undefined;
    filename?: string | undefined;
};
export type ChatMessageContentItemFile = {
    type: "file";
    file: FileT;
};
/** @internal */
export declare const FileT$inboundSchema: z.ZodType<FileT, unknown>;
/** @internal */
export type FileT$Outbound = {
    file_data: string;
    file_id?: string | undefined;
    filename?: string | undefined;
};
/** @internal */
export declare const FileT$outboundSchema: z.ZodType<FileT$Outbound, FileT>;
export declare function fileToJSON(fileT: FileT): string;
export declare function fileFromJSON(jsonString: string): SafeParseResult<FileT, SDKValidationError>;
/** @internal */
export declare const ChatMessageContentItemFile$inboundSchema: z.ZodType<ChatMessageContentItemFile, unknown>;
/** @internal */
export type ChatMessageContentItemFile$Outbound = {
    type: "file";
    file: FileT$Outbound;
};
/** @internal */
export declare const ChatMessageContentItemFile$outboundSchema: z.ZodType<ChatMessageContentItemFile$Outbound, ChatMessageContentItemFile>;
export declare function chatMessageContentItemFileToJSON(chatMessageContentItemFile: ChatMessageContentItemFile): string;
export declare function chatMessageContentItemFileFromJSON(jsonString: string): SafeParseResult<ChatMessageContentItemFile, SDKValidationError>;
//# sourceMappingURL=chatmessagecontentitemfile.d.ts.map