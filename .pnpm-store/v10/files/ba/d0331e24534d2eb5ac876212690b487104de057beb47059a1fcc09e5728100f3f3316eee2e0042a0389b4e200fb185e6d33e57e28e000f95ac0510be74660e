import * as z from "zod/v4";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
/**
 * Error data for InternalServerResponse
 */
export type InternalServerResponseErrorData = {
    code: number;
    message: string;
    metadata?: {
        [k: string]: any | null;
    } | null | undefined;
};
/** @internal */
export declare const InternalServerResponseErrorData$inboundSchema: z.ZodType<InternalServerResponseErrorData, unknown>;
export declare function internalServerResponseErrorDataFromJSON(jsonString: string): SafeParseResult<InternalServerResponseErrorData, SDKValidationError>;
//# sourceMappingURL=internalserverresponseerrordata.d.ts.map