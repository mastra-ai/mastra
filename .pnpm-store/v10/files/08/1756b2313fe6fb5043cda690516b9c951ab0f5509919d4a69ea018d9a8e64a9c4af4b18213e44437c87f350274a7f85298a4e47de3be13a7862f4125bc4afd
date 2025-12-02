import * as z from "zod/v4";
import { EventStream } from "../../lib/event-streams.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
/**
 * Successful response
 */
export type CreateResponsesResponseBody = {
    /**
     * Union of all possible event types emitted during response streaming
     */
    data: models.OpenResponsesStreamEvent;
};
export type CreateResponsesResponse = models.OpenResponsesNonStreamingResponse | EventStream<models.OpenResponsesStreamEvent>;
/** @internal */
export declare const CreateResponsesResponseBody$inboundSchema: z.ZodType<CreateResponsesResponseBody, unknown>;
export declare function createResponsesResponseBodyFromJSON(jsonString: string): SafeParseResult<CreateResponsesResponseBody, SDKValidationError>;
/** @internal */
export declare const CreateResponsesResponse$inboundSchema: z.ZodType<CreateResponsesResponse, unknown>;
export declare function createResponsesResponseFromJSON(jsonString: string): SafeParseResult<CreateResponsesResponse, SDKValidationError>;
//# sourceMappingURL=createresponses.d.ts.map