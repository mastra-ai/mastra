import { EventStream } from "../lib/event-streams.js";
import { ClientSDK, RequestOptions } from "../lib/sdks.js";
import * as models from "../models/index.js";
import * as operations from "../models/operations/index.js";
export declare class Responses extends ClientSDK {
    /**
     * Create a response
     *
     * @remarks
     * Creates a streaming or non-streaming response using OpenResponses API format
     */
    send(request: models.OpenResponsesRequest & {
        stream?: false | undefined;
    }, options?: RequestOptions): Promise<models.OpenResponsesNonStreamingResponse>;
    send(request: models.OpenResponsesRequest & {
        stream: true;
    }, options?: RequestOptions): Promise<EventStream<models.OpenResponsesStreamEvent>>;
    send(request: models.OpenResponsesRequest, options?: RequestOptions): Promise<operations.CreateResponsesResponse>;
}
//# sourceMappingURL=responses.d.ts.map