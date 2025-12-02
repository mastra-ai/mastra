import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type DeleteKeysRequest = {
    /**
     * The hash identifier of the API key to delete
     */
    hash: string;
};
/**
 * API key deleted successfully
 */
export type DeleteKeysResponse = {
    /**
     * Confirmation that the API key was deleted
     */
    deleted: true;
};
/** @internal */
export type DeleteKeysRequest$Outbound = {
    hash: string;
};
/** @internal */
export declare const DeleteKeysRequest$outboundSchema: z.ZodType<DeleteKeysRequest$Outbound, DeleteKeysRequest>;
export declare function deleteKeysRequestToJSON(deleteKeysRequest: DeleteKeysRequest): string;
/** @internal */
export declare const DeleteKeysResponse$inboundSchema: z.ZodType<DeleteKeysResponse, unknown>;
export declare function deleteKeysResponseFromJSON(jsonString: string): SafeParseResult<DeleteKeysResponse, SDKValidationError>;
//# sourceMappingURL=deletekeys.d.ts.map