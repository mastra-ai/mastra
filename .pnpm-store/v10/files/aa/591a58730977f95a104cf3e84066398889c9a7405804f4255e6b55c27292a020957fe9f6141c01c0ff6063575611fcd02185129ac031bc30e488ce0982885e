import { OpenRouterCore } from "../core.js";
import { EventStream } from "../lib/event-streams.js";
import { RequestOptions } from "../lib/sdks.js";
import { ConnectionError, InvalidRequestError, RequestAbortedError, RequestTimeoutError, UnexpectedClientError } from "../models/errors/httpclienterrors.js";
import * as errors from "../models/errors/index.js";
import { OpenRouterError } from "../models/errors/openroutererror.js";
import { ResponseValidationError } from "../models/errors/responsevalidationerror.js";
import { SDKValidationError } from "../models/errors/sdkvalidationerror.js";
import * as models from "../models/index.js";
import * as operations from "../models/operations/index.js";
import { APIPromise } from "../types/async.js";
import { Result } from "../types/fp.js";
/**
 * Create a chat completion
 *
 * @remarks
 * Sends a request for a model response for the given chat conversation. Supports both streaming and non-streaming modes.
 */
export declare function chatSend(client: OpenRouterCore, request: models.ChatGenerationParams & {
    stream?: false;
}, options?: RequestOptions): APIPromise<Result<models.ChatResponse, errors.ChatError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
export declare function chatSend(client: OpenRouterCore, request: models.ChatGenerationParams & {
    stream: true;
}, options?: RequestOptions): APIPromise<Result<EventStream<models.ChatStreamingResponseChunkData>, errors.ChatError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
export declare function chatSend(client: OpenRouterCore, request: models.ChatGenerationParams, options?: RequestOptions): APIPromise<Result<operations.SendChatCompletionRequestResponse, errors.ChatError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
//# sourceMappingURL=chatSend.d.ts.map