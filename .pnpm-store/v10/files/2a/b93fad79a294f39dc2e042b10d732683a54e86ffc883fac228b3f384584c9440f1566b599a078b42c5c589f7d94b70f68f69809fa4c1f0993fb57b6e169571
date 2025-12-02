import * as z from "zod/v4";
import * as models from "../index.js";
import { OpenRouterError } from "./openroutererror.js";
export type ChatErrorData = {
    error: models.ChatErrorError;
};
export declare class ChatError extends OpenRouterError {
    error: models.ChatErrorError;
    /** The original data that was passed to this error instance. */
    data$: ChatErrorData;
    constructor(err: ChatErrorData, httpMeta: {
        response: Response;
        request: Request;
        body: string;
    });
}
/** @internal */
export declare const ChatError$inboundSchema: z.ZodType<ChatError, unknown>;
//# sourceMappingURL=chaterror.d.ts.map