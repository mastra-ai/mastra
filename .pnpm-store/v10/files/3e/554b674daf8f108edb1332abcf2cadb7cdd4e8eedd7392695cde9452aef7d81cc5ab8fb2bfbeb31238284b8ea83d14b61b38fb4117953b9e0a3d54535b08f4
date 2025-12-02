import * as z from "zod/v4";
import { EventStream } from "../../lib/event-streams.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
export type SendChatCompletionRequestResponse = models.ChatResponse | EventStream<models.ChatStreamingResponseChunkData>;
/** @internal */
export declare const SendChatCompletionRequestResponse$inboundSchema: z.ZodType<SendChatCompletionRequestResponse, unknown>;
export declare function sendChatCompletionRequestResponseFromJSON(jsonString: string): SafeParseResult<SendChatCompletionRequestResponse, SDKValidationError>;
//# sourceMappingURL=sendchatcompletionrequest.d.ts.map