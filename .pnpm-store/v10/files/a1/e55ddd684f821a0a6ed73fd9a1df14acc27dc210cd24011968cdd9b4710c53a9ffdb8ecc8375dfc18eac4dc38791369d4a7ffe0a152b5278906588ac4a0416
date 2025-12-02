import { EventStream } from "../lib/event-streams.js";
import { ClientSDK, RequestOptions } from "../lib/sdks.js";
import * as models from "../models/index.js";
import * as operations from "../models/operations/index.js";
export declare class Chat extends ClientSDK {
    /**
     * Create a chat completion
     *
     * @remarks
     * Sends a request for a model response for the given chat conversation. Supports both streaming and non-streaming modes.
     */
    send(request: models.ChatGenerationParams & {
        stream?: false | undefined;
    }, options?: RequestOptions): Promise<models.ChatResponse>;
    send(request: models.ChatGenerationParams & {
        stream: true;
    }, options?: RequestOptions): Promise<EventStream<models.ChatStreamingResponseChunkData>>;
    send(request: models.ChatGenerationParams, options?: RequestOptions): Promise<operations.SendChatCompletionRequestResponse>;
}
//# sourceMappingURL=chat.d.ts.map