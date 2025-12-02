import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponseInputFileType: {
    readonly InputFile: "input_file";
};
export type ResponseInputFileType = ClosedEnum<typeof ResponseInputFileType>;
/**
 * File input content item
 */
export type ResponseInputFile = {
    type: ResponseInputFileType;
    fileId?: string | null | undefined;
    fileData?: string | undefined;
    filename?: string | undefined;
    fileUrl?: string | undefined;
};
/** @internal */
export declare const ResponseInputFileType$inboundSchema: z.ZodEnum<typeof ResponseInputFileType>;
/** @internal */
export declare const ResponseInputFileType$outboundSchema: z.ZodEnum<typeof ResponseInputFileType>;
/** @internal */
export declare const ResponseInputFile$inboundSchema: z.ZodType<ResponseInputFile, unknown>;
/** @internal */
export type ResponseInputFile$Outbound = {
    type: string;
    file_id?: string | null | undefined;
    file_data?: string | undefined;
    filename?: string | undefined;
    file_url?: string | undefined;
};
/** @internal */
export declare const ResponseInputFile$outboundSchema: z.ZodType<ResponseInputFile$Outbound, ResponseInputFile>;
export declare function responseInputFileToJSON(responseInputFile: ResponseInputFile): string;
export declare function responseInputFileFromJSON(jsonString: string): SafeParseResult<ResponseInputFile, SDKValidationError>;
//# sourceMappingURL=responseinputfile.d.ts.map