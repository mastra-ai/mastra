import * as z from "zod/v4";
import { ClosedEnum, OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const ResponseInputImageType: {
    readonly InputImage: "input_image";
};
export type ResponseInputImageType = ClosedEnum<typeof ResponseInputImageType>;
export declare const ResponseInputImageDetail: {
    readonly Auto: "auto";
    readonly High: "high";
    readonly Low: "low";
};
export type ResponseInputImageDetail = OpenEnum<typeof ResponseInputImageDetail>;
/**
 * Image input content item
 */
export type ResponseInputImage = {
    type: ResponseInputImageType;
    detail: ResponseInputImageDetail;
    imageUrl?: string | null | undefined;
};
/** @internal */
export declare const ResponseInputImageType$inboundSchema: z.ZodEnum<typeof ResponseInputImageType>;
/** @internal */
export declare const ResponseInputImageType$outboundSchema: z.ZodEnum<typeof ResponseInputImageType>;
/** @internal */
export declare const ResponseInputImageDetail$inboundSchema: z.ZodType<ResponseInputImageDetail, unknown>;
/** @internal */
export declare const ResponseInputImageDetail$outboundSchema: z.ZodType<string, ResponseInputImageDetail>;
/** @internal */
export declare const ResponseInputImage$inboundSchema: z.ZodType<ResponseInputImage, unknown>;
/** @internal */
export type ResponseInputImage$Outbound = {
    type: string;
    detail: string;
    image_url?: string | null | undefined;
};
/** @internal */
export declare const ResponseInputImage$outboundSchema: z.ZodType<ResponseInputImage$Outbound, ResponseInputImage>;
export declare function responseInputImageToJSON(responseInputImage: ResponseInputImage): string;
export declare function responseInputImageFromJSON(jsonString: string): SafeParseResult<ResponseInputImage, SDKValidationError>;
//# sourceMappingURL=responseinputimage.d.ts.map