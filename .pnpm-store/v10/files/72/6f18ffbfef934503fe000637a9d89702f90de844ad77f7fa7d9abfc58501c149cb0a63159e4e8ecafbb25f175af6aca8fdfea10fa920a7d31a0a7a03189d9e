import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
import { Result as SafeParseResult } from "../types/fp.js";
import { SDKValidationError } from "./errors/sdkvalidationerror.js";
export declare const CodeEnum: {
    readonly ServerError: "server_error";
    readonly RateLimitExceeded: "rate_limit_exceeded";
    readonly InvalidPrompt: "invalid_prompt";
    readonly VectorStoreTimeout: "vector_store_timeout";
    readonly InvalidImage: "invalid_image";
    readonly InvalidImageFormat: "invalid_image_format";
    readonly InvalidBase64Image: "invalid_base64_image";
    readonly InvalidImageUrl: "invalid_image_url";
    readonly ImageTooLarge: "image_too_large";
    readonly ImageTooSmall: "image_too_small";
    readonly ImageParseError: "image_parse_error";
    readonly ImageContentPolicyViolation: "image_content_policy_violation";
    readonly InvalidImageMode: "invalid_image_mode";
    readonly ImageFileTooLarge: "image_file_too_large";
    readonly UnsupportedImageMediaType: "unsupported_image_media_type";
    readonly EmptyImageFile: "empty_image_file";
    readonly FailedToDownloadImage: "failed_to_download_image";
    readonly ImageFileNotFound: "image_file_not_found";
};
export type CodeEnum = OpenEnum<typeof CodeEnum>;
/**
 * Error information returned from the API
 */
export type ResponsesErrorField = {
    code: CodeEnum;
    message: string;
};
/** @internal */
export declare const CodeEnum$inboundSchema: z.ZodType<CodeEnum, unknown>;
/** @internal */
export declare const ResponsesErrorField$inboundSchema: z.ZodType<ResponsesErrorField, unknown>;
export declare function responsesErrorFieldFromJSON(jsonString: string): SafeParseResult<ResponsesErrorField, SDKValidationError>;
//# sourceMappingURL=responseserrorfield.d.ts.map