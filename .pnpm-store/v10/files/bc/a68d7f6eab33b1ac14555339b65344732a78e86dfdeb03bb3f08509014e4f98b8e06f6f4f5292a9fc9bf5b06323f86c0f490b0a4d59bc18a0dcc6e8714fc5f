import { jsonToConvex } from "../../values/index.js";
import { logForFunction, Logger } from "../logging.js";
import { Long } from "../../vendor/long.js";
import { FunctionResult } from "./function_result.js";
import {
  ActionRequest,
  ActionResponse,
  ClientMessage,
  MutationRequest,
  MutationResponse,
  RequestId,
} from "./protocol.js";

type RequestStatus =
  | {
      status: "Requested" | "NotSent";
      onResult: (result: FunctionResult) => void;
      requestedAt: Date;
    }
  | {
      status: "Completed";
      result: FunctionResult;
      onResolve: () => void;
      ts: Long;
    };

export class RequestManager {
  private inflightRequests: Map<
    RequestId,
    {
      message: MutationRequest | ActionRequest;
      status: RequestStatus;
    }
  >;
  private requestsOlderThanRestart: Set<RequestId>;
  private inflightMutationsCount: number = 0;
  private inflightActionsCount: number = 0;
  constructor(
    private readonly logger: Logger,
    private readonly markConnectionStateDirty: () => void,
  ) {
    this.inflightRequests = new Map();
    this.requestsOlderThanRestart = new Set();
  }

  request(
    message: MutationRequest | ActionRequest,
    sent: boolean,
  ): Promise<FunctionResult> {
    const result = new Promise<FunctionResult>((resolve) => {
      const status = sent ? "Requested" : "NotSent";
      this.inflightRequests.set(message.requestId, {
        message,
        status: { status, requestedAt: new Date(), onResult: resolve },
      });

      if (message.type === "Mutation") {
        this.inflightMutationsCount++;
      } else if (message.type === "Action") {
        this.inflightActionsCount++;
      }
    });

    this.markConnectionStateDirty();
    return result;
  }

  /**
   * Update the state after receiving a response.
   *
   * @returns A RequestId if the request is complete and its optimistic update
   * can be dropped, null otherwise.
   */
  onResponse(
    response: MutationResponse | ActionResponse,
  ): { requestId: RequestId; result: FunctionResult } | null {
    const requestInfo = this.inflightRequests.get(response.requestId);
    if (requestInfo === undefined) {
      // Annoyingly we can occasionally get responses to mutations that we're no
      // longer tracking. One flow where this happens is:
      // 1. Client sends mutation 1
      // 2. Client gets response for mutation 1. The sever says that it was committed at ts=10.
      // 3. Client is disconnected
      // 4. Client reconnects and re-issues queries and this mutation.
      // 5. Server sends transition message to ts=20
      // 6. Client drops mutation because it's already been observed.
      // 7. Client receives a second response for mutation 1 but doesn't know about it anymore.

      // The right fix for this is probably to add a reconciliation phase on
      // reconnection where we receive responses to all the mutations before
      // the transition message so this flow could never happen (CX-1513).

      // For now though, we can just ignore this message.
      return null;
    }

    // Because `.restart()` re-requests completed requests, we may get some
    // responses for requests that are already in the "Completed" state.
    // We can safely ignore those because we've already notified the UI about
    // their results.
    if (requestInfo.status.status === "Completed") {
      return null;
    }

    const udfType =
      requestInfo.message.type === "Mutation" ? "mutation" : "action";
    const udfPath = requestInfo.message.udfPath;

    for (const line of response.logLines) {
      logForFunction(this.logger, "info", udfType, udfPath, line);
    }

    const status = requestInfo.status;
    let result: FunctionResult;
    let onResolve;
    if (response.success) {
      result = {
        success: true,
        logLines: response.logLines,
        value: jsonToConvex(response.result),
      };
      onResolve = () => status.onResult(result);
    } else {
      const errorMessage = response.result as string;
      const { errorData } = response;
      logForFunction(this.logger, "error", udfType, udfPath, errorMessage);
      result = {
        success: false,
        errorMessage,
        errorData:
          errorData !== undefined ? jsonToConvex(errorData) : undefined,
        logLines: response.logLines,
      };
      onResolve = () => status.onResult(result);
    }

    // We can resolve Mutation failures immediately since they don't have any
    // side effects. Actions are intentionally decoupled from
    // queries/mutations here on the sync protocol since they have different
    // guarantees.
    if (response.type === "ActionResponse" || !response.success) {
      onResolve();
      this.inflightRequests.delete(response.requestId);
      this.requestsOlderThanRestart.delete(response.requestId);

      if (requestInfo.message.type === "Action") {
        this.inflightActionsCount--;
      } else if (requestInfo.message.type === "Mutation") {
        this.inflightMutationsCount--;
      }

      this.markConnectionStateDirty();
      return { requestId: response.requestId, result };
    }

    // We have to wait to resolve the request promise until after we transition
    // past this timestamp so clients can read their own writes.
    requestInfo.status = {
      status: "Completed",
      result,
      ts: response.ts,
      onResolve,
    };

    return null;
  }

  // Remove and returns completed requests.
  removeCompleted(ts: Long): Map<RequestId, FunctionResult> {
    const completeRequests: Map<RequestId, FunctionResult> = new Map();
    for (const [requestId, requestInfo] of this.inflightRequests.entries()) {
      const status = requestInfo.status;
      if (status.status === "Completed" && status.ts.lessThanOrEqual(ts)) {
        status.onResolve();
        completeRequests.set(requestId, status.result);

        if (requestInfo.message.type === "Mutation") {
          this.inflightMutationsCount--;
        } else if (requestInfo.message.type === "Action") {
          this.inflightActionsCount--;
        }

        this.inflightRequests.delete(requestId);
        this.requestsOlderThanRestart.delete(requestId);
      }
    }
    if (completeRequests.size > 0) {
      this.markConnectionStateDirty();
    }
    return completeRequests;
  }

  restart(): ClientMessage[] {
    // When we reconnect to the backend, re-request all requests that are safe
    // to be resend.

    this.requestsOlderThanRestart = new Set(this.inflightRequests.keys());
    const allMessages = [];
    for (const [requestId, value] of this.inflightRequests) {
      if (value.status.status === "NotSent") {
        value.status.status = "Requested";
        allMessages.push(value.message);
        continue;
      }

      if (value.message.type === "Mutation") {
        // This includes ones that have already been completed because we still
        // want to tell the backend to transition the client past the completed
        // timestamp. This is safe since mutations are idempotent.
        allMessages.push(value.message);
      } else if (value.message.type === "Action") {
        // Unlike mutations, actions are not idempotent. When we reconnect to the
        // backend, we don't know if it is safe to resend in-flight actions, so we
        // cancel them and consider them failed.
        this.inflightRequests.delete(requestId);
        this.requestsOlderThanRestart.delete(requestId);
        this.inflightActionsCount--;
        if (value.status.status === "Completed") {
          throw new Error("Action should never be in 'Completed' state");
        }
        value.status.onResult({
          success: false,
          errorMessage: "Connection lost while action was in flight",
          logLines: [],
        });
      }
    }
    this.markConnectionStateDirty();
    return allMessages;
  }

  resume(): ClientMessage[] {
    const allMessages = [];
    for (const [, value] of this.inflightRequests) {
      if (value.status.status === "NotSent") {
        value.status.status = "Requested";
        allMessages.push(value.message);
        continue;
      }
    }
    return allMessages;
  }

  /**
   * @returns true if there are any requests that have been requested but have
   * not be completed yet.
   */
  hasIncompleteRequests(): boolean {
    for (const requestInfo of this.inflightRequests.values()) {
      if (requestInfo.status.status === "Requested") {
        return true;
      }
    }
    return false;
  }

  /**
   * @returns true if there are any inflight requests, including ones that have
   * completed on the server, but have not been applied.
   */
  hasInflightRequests(): boolean {
    return this.inflightRequests.size > 0;
  }

  /**
   * @returns true if there are any inflight requests, that have been hanging around
   * since prior to the most recent restart.
   */
  hasSyncedPastLastReconnect(): boolean {
    return this.requestsOlderThanRestart.size === 0;
  }

  timeOfOldestInflightRequest(): Date | null {
    if (this.inflightRequests.size === 0) {
      return null;
    }
    let oldestInflightRequest = Date.now();
    for (const request of this.inflightRequests.values()) {
      if (request.status.status !== "Completed") {
        if (request.status.requestedAt.getTime() < oldestInflightRequest) {
          oldestInflightRequest = request.status.requestedAt.getTime();
        }
      }
    }
    return new Date(oldestInflightRequest);
  }

  /**
   * @returns The number of mutations currently in flight.
   */
  inflightMutations(): number {
    return this.inflightMutationsCount;
  }

  /**
   * @returns The number of actions currently in flight.
   */
  inflightActions(): number {
    return this.inflightActionsCount;
  }
}
