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
 * Create a response
 *
 * @remarks
 * Creates a streaming or non-streaming response using OpenResponses API format
 */
export declare function betaResponsesSend(client: OpenRouterCore, request: models.OpenResponsesRequest & {
    stream?: false;
}, options?: RequestOptions): APIPromise<Result<models.OpenResponsesNonStreamingResponse, errors.BadRequestResponseError | errors.UnauthorizedResponseError | errors.PaymentRequiredResponseError | errors.NotFoundResponseError | errors.RequestTimeoutResponseError | errors.PayloadTooLargeResponseError | errors.UnprocessableEntityResponseError | errors.TooManyRequestsResponseError | errors.InternalServerResponseError | errors.BadGatewayResponseError | errors.ServiceUnavailableResponseError | errors.EdgeNetworkTimeoutResponseError | errors.ProviderOverloadedResponseError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
export declare function betaResponsesSend(client: OpenRouterCore, request: models.OpenResponsesRequest & {
    stream: true;
}, options?: RequestOptions): APIPromise<Result<EventStream<models.OpenResponsesStreamEvent>, errors.BadRequestResponseError | errors.UnauthorizedResponseError | errors.PaymentRequiredResponseError | errors.NotFoundResponseError | errors.RequestTimeoutResponseError | errors.PayloadTooLargeResponseError | errors.UnprocessableEntityResponseError | errors.TooManyRequestsResponseError | errors.InternalServerResponseError | errors.BadGatewayResponseError | errors.ServiceUnavailableResponseError | errors.EdgeNetworkTimeoutResponseError | errors.ProviderOverloadedResponseError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
export declare function betaResponsesSend(client: OpenRouterCore, request: models.OpenResponsesRequest, options?: RequestOptions): APIPromise<Result<operations.CreateResponsesResponse, errors.BadRequestResponseError | errors.UnauthorizedResponseError | errors.PaymentRequiredResponseError | errors.NotFoundResponseError | errors.RequestTimeoutResponseError | errors.PayloadTooLargeResponseError | errors.UnprocessableEntityResponseError | errors.TooManyRequestsResponseError | errors.InternalServerResponseError | errors.BadGatewayResponseError | errors.ServiceUnavailableResponseError | errors.EdgeNetworkTimeoutResponseError | errors.ProviderOverloadedResponseError | OpenRouterError | ResponseValidationError | ConnectionError | RequestAbortedError | RequestTimeoutError | InvalidRequestError | UnexpectedClientError | SDKValidationError>>;
//# sourceMappingURL=betaResponsesSend.d.ts.map