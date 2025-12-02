import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const FileCitationType: {
    readonly FileCitation: "file_citation";
};
export type FileCitationType = ClosedEnum<typeof FileCitationType>;
export type FileCitation = {
    type: FileCitationType;
    fileId: string;
    filename: string;
    index: number;
};
/** @internal */
export declare const FileCitationType$inboundSchema: z.ZodEnum<typeof FileCitationType>;
/** @internal */
export declare const FileCitationType$outboundSchema: z.ZodEnum<typeof FileCitationType>;
/** @internal */
export declare const FileCitation$inboundSchema: z.ZodType<FileCitation, unknown>;
/** @internal */
export type FileCitation$Outbound = {
    type: string;
    file_id: string;
    filename: string;
    index: number;
};
/** @internal */
export declare const FileCitation$outboundSchema: z.ZodType<FileCitation$Outbound, FileCitation>;
export declare function fileCitationToJSON(fileCitation: FileCitation): string;
export declare function fileCitationFromJSON(jsonString: string): SafeParseResult<FileCitation, SDKValidationError>;
//# sourceMappingURL=filecitation.d.ts.map