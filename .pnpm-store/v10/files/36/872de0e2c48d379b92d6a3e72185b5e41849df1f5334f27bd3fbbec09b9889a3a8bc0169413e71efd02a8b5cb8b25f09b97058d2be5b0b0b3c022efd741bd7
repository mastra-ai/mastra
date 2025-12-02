"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsonToConvex } from "../../values/index.js";
import { logForFunction } from "../logging.js";
export class RequestManager {
  constructor(logger, markConnectionStateDirty) {
    this.logger = logger;
    this.markConnectionStateDirty = markConnectionStateDirty;
    __publicField(this, "inflightRequests");
    __publicField(this, "requestsOlderThanRestart");
    __publicField(this, "inflightMutationsCount", 0);
    __publicField(this, "inflightActionsCount", 0);
    this.inflightRequests = /* @__PURE__ */ new Map();
    this.requestsOlderThanRestart = /* @__PURE__ */ new Set();
  }
  request(message, sent) {
    const result = new Promise((resolve) => {
      const status = sent ? "Requested" : "NotSent";
      this.inflightRequests.set(message.requestId, {
        message,
        status: { status, requestedAt: /* @__PURE__ */ new Date(), onResult: resolve }
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
  onResponse(response) {
    const requestInfo = this.inflightRequests.get(response.requestId);
    if (requestInfo === void 0) {
      return null;
    }
    if (requestInfo.status.status === "Completed") {
      return null;
    }
    const udfType = requestInfo.message.type === "Mutation" ? "mutation" : "action";
    const udfPath = requestInfo.message.udfPath;
    for (const line of response.logLines) {
      logForFunction(this.logger, "info", udfType, udfPath, line);
    }
    const status = requestInfo.status;
    let result;
    let onResolve;
    if (response.success) {
      result = {
        success: true,
        logLines: response.logLines,
        value: jsonToConvex(response.result)
      };
      onResolve = () => status.onResult(result);
    } else {
      const errorMessage = response.result;
      const { errorData } = response;
      logForFunction(this.logger, "error", udfType, udfPath, errorMessage);
      result = {
        success: false,
        errorMessage,
        errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
        logLines: response.logLines
      };
      onResolve = () => status.onResult(result);
    }
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
    requestInfo.status = {
      status: "Completed",
      result,
      ts: response.ts,
      onResolve
    };
    return null;
  }
  // Remove and returns completed requests.
  removeCompleted(ts) {
    const completeRequests = /* @__PURE__ */ new Map();
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
  restart() {
    this.requestsOlderThanRestart = new Set(this.inflightRequests.keys());
    const allMessages = [];
    for (const [requestId, value] of this.inflightRequests) {
      if (value.status.status === "NotSent") {
        value.status.status = "Requested";
        allMessages.push(value.message);
        continue;
      }
      if (value.message.type === "Mutation") {
        allMessages.push(value.message);
      } else if (value.message.type === "Action") {
        this.inflightRequests.delete(requestId);
        this.requestsOlderThanRestart.delete(requestId);
        this.inflightActionsCount--;
        if (value.status.status === "Completed") {
          throw new Error("Action should never be in 'Completed' state");
        }
        value.status.onResult({
          success: false,
          errorMessage: "Connection lost while action was in flight",
          logLines: []
        });
      }
    }
    this.markConnectionStateDirty();
    return allMessages;
  }
  resume() {
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
  hasIncompleteRequests() {
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
  hasInflightRequests() {
    return this.inflightRequests.size > 0;
  }
  /**
   * @returns true if there are any inflight requests, that have been hanging around
   * since prior to the most recent restart.
   */
  hasSyncedPastLastReconnect() {
    return this.requestsOlderThanRestart.size === 0;
  }
  timeOfOldestInflightRequest() {
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
  inflightMutations() {
    return this.inflightMutationsCount;
  }
  /**
   * @returns The number of actions currently in flight.
   */
  inflightActions() {
    return this.inflightActionsCount;
  }
}
//# sourceMappingURL=request_manager.js.map
