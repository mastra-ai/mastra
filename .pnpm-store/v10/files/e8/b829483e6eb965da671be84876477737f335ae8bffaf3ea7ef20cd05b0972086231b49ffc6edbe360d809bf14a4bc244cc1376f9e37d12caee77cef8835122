import { Logger } from "../logging.js";
import { Long } from "../../vendor/long.js";
import { FunctionResult } from "./function_result.js";
import { ActionRequest, ActionResponse, ClientMessage, MutationRequest, MutationResponse, RequestId } from "./protocol.js";
export declare class RequestManager {
    private readonly logger;
    private readonly markConnectionStateDirty;
    private inflightRequests;
    private requestsOlderThanRestart;
    private inflightMutationsCount;
    private inflightActionsCount;
    constructor(logger: Logger, markConnectionStateDirty: () => void);
    request(message: MutationRequest | ActionRequest, sent: boolean): Promise<FunctionResult>;
    /**
     * Update the state after receiving a response.
     *
     * @returns A RequestId if the request is complete and its optimistic update
     * can be dropped, null otherwise.
     */
    onResponse(response: MutationResponse | ActionResponse): {
        requestId: RequestId;
        result: FunctionResult;
    } | null;
    removeCompleted(ts: Long): Map<RequestId, FunctionResult>;
    restart(): ClientMessage[];
    resume(): ClientMessage[];
    /**
     * @returns true if there are any requests that have been requested but have
     * not be completed yet.
     */
    hasIncompleteRequests(): boolean;
    /**
     * @returns true if there are any inflight requests, including ones that have
     * completed on the server, but have not been applied.
     */
    hasInflightRequests(): boolean;
    /**
     * @returns true if there are any inflight requests, that have been hanging around
     * since prior to the most recent restart.
     */
    hasSyncedPastLastReconnect(): boolean;
    timeOfOldestInflightRequest(): Date | null;
    /**
     * @returns The number of mutations currently in flight.
     */
    inflightMutations(): number;
    /**
     * @returns The number of actions currently in flight.
     */
    inflightActions(): number;
}
//# sourceMappingURL=request_manager.d.ts.map