import * as z from "zod/v4";
import { ClosedEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const FilePathType: {
    readonly FilePath: "file_path";
};
export type FilePathType = ClosedEnum<typeof FilePathType>;
export type FilePath = {
    type: FilePathType;
    fileId: string;
    index: number;
};
/** @internal */
export declare const FilePathType$inboundSchema: z.ZodEnum<typeof FilePathType>;
/** @internal */
export declare const FilePathType$outboundSchema: z.ZodEnum<typeof FilePathType>;
/** @internal */
export declare const FilePath$inboundSchema: z.ZodType<FilePath, unknown>;
/** @internal */
export type FilePath$Outbound = {
    type: string;
    file_id: string;
    index: number;
};
/** @internal */
export declare const FilePath$outboundSchema: z.ZodType<FilePath$Outbound, FilePath>;
export declare function filePathToJSON(filePath: FilePath): string;
export declare function filePathFromJSON(jsonString: string): SafeParseResult<FilePath, SDKValidationError>;
//# sourceMappingURL=filepath.d.ts.map