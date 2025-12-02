"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { validateDeploymentUrl } from "../common/index.js";
import {
  BaseConvexClient
} from "./index.js";
import { getFunctionName } from "../server/api.js";
let defaultWebSocketConstructor;
export function setDefaultWebSocketConstructor(ws) {
  defaultWebSocketConstructor = ws;
}
export class ConvexClient {
  /**
   * Construct a client and immediately initiate a WebSocket connection to the passed address.
   *
   * @public
   */
  constructor(address, options = {}) {
    __publicField(this, "listeners");
    __publicField(this, "_client");
    // A synthetic server event to run callbacks the first time
    __publicField(this, "callNewListenersWithCurrentValuesTimer");
    __publicField(this, "_closed");
    __publicField(this, "_disabled");
    if (options.skipConvexDeploymentUrlCheck !== true) {
      validateDeploymentUrl(address);
    }
    const { disabled, ...baseOptions } = options;
    this._closed = false;
    this._disabled = !!disabled;
    if (defaultWebSocketConstructor && !("webSocketConstructor" in baseOptions) && typeof WebSocket === "undefined") {
      baseOptions.webSocketConstructor = defaultWebSocketConstructor;
    }
    if (typeof window === "undefined" && !("unsavedChangesWarning" in baseOptions)) {
      baseOptions.unsavedChangesWarning = false;
    }
    if (!this.disabled) {
      this._client = new BaseConvexClient(
        address,
        (updatedQueries) => this._transition(updatedQueries),
        baseOptions
      );
    }
    this.listeners = /* @__PURE__ */ new Set();
  }
  /**
   * Once closed no registered callbacks will fire again.
   */
  get closed() {
    return this._closed;
  }
  get client() {
    if (this._client) return this._client;
    throw new Error("ConvexClient is disabled");
  }
  get disabled() {
    return this._disabled;
  }
  /**
   * Call a callback whenever a new result for a query is received. The callback
   * will run soon after being registered if a result for the query is already
   * in memory.
   *
   * The return value is an {@link Unsubscribe} object which is both a function
   * an an object with properties. Both of the patterns below work with this object:
   *
   *```ts
   * // call the return value as a function
   * const unsubscribe = client.onUpdate(api.messages.list, {}, (messages) => {
   *   console.log(messages);
   * });
   * unsubscribe();
   *
   * // unpack the return value into its properties
   * const {
   *   getCurrentValue,
   *   unsubscribe,
   * } = client.onUpdate(api.messages.list, {}, (messages) => {
   *   console.log(messages);
   * });
   *```
   *
   * @param query - A {@link server.FunctionReference} for the public query to run.
   * @param args - The arguments to run the query with.
   * @param callback - Function to call when the query result updates.
   * @param onError - Function to call when the query result updates with an error.
   * If not provided, errors will be thrown instead of calling the callback.
   *
   * @return an {@link Unsubscribe} function to stop calling the onUpdate function.
   */
  onUpdate(query, args, callback, onError) {
    if (this.disabled) {
      const disabledUnsubscribe = () => {
      };
      const unsubscribeProps2 = {
        unsubscribe: disabledUnsubscribe,
        getCurrentValue: () => void 0,
        getQueryLogs: () => void 0
      };
      Object.assign(disabledUnsubscribe, unsubscribeProps2);
      return disabledUnsubscribe;
    }
    const { queryToken, unsubscribe } = this.client.subscribe(
      getFunctionName(query),
      args
    );
    const queryInfo = {
      queryToken,
      callback,
      onError,
      unsubscribe,
      hasEverRun: false,
      query,
      args
    };
    this.listeners.add(queryInfo);
    if (this.queryResultReady(queryToken) && this.callNewListenersWithCurrentValuesTimer === void 0) {
      this.callNewListenersWithCurrentValuesTimer = setTimeout(
        () => this.callNewListenersWithCurrentValues(),
        0
      );
    }
    const unsubscribeProps = {
      unsubscribe: () => {
        if (this.closed) {
          return;
        }
        this.listeners.delete(queryInfo);
        unsubscribe();
      },
      getCurrentValue: () => this.client.localQueryResultByToken(queryToken),
      getQueryLogs: () => this.client.localQueryLogs(queryToken)
    };
    const ret = unsubscribeProps.unsubscribe;
    Object.assign(ret, unsubscribeProps);
    return ret;
  }
  // Run all callbacks that have never been run before if they have a query
  // result available now.
  callNewListenersWithCurrentValues() {
    this.callNewListenersWithCurrentValuesTimer = void 0;
    this._transition([], true);
  }
  queryResultReady(queryToken) {
    return this.client.hasLocalQueryResultByToken(queryToken);
  }
  async close() {
    if (this.disabled) return;
    this.listeners.clear();
    this._closed = true;
    return this.client.close();
  }
  /**
   * Get the current JWT auth token and decoded claims.
   */
  getAuth() {
    if (this.disabled) return;
    return this.client.getCurrentAuthClaims();
  }
  /**
   * Set the authentication token to be used for subsequent queries and mutations.
   * `fetchToken` will be called automatically again if a token expires.
   * `fetchToken` should return `null` if the token cannot be retrieved, for example
   * when the user's rights were permanently revoked.
   * @param fetchToken - an async function returning the JWT (typically an OpenID Connect Identity Token)
   * @param onChange - a callback that will be called when the authentication status changes
   */
  setAuth(fetchToken, onChange) {
    if (this.disabled) return;
    this.client.setAuth(
      fetchToken,
      onChange ?? (() => {
      })
    );
  }
  /**
   * @internal
   */
  setAdminAuth(token, identity) {
    if (this.closed) {
      throw new Error("ConvexClient has already been closed.");
    }
    if (this.disabled) return;
    this.client.setAdminAuth(token, identity);
  }
  /**
   * @internal
   */
  _transition(updatedQueries, callNewListeners = false) {
    for (const queryInfo of this.listeners) {
      const { callback, queryToken, onError, hasEverRun } = queryInfo;
      if (updatedQueries.includes(queryToken) || callNewListeners && !hasEverRun && this.client.hasLocalQueryResultByToken(queryToken)) {
        queryInfo.hasEverRun = true;
        let newValue;
        try {
          newValue = this.client.localQueryResultByToken(queryToken);
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          if (onError) {
            onError(
              error,
              "Second argument to onUpdate onError is reserved for later use"
            );
          } else {
            void Promise.reject(error);
          }
          continue;
        }
        callback(
          newValue,
          "Second argument to onUpdate callback is reserved for later use"
        );
      }
    }
  }
  /**
   * Execute a mutation function.
   *
   * @param mutation - A {@link server.FunctionReference} for the public mutation
   * to run.
   * @param args - An arguments object for the mutation.
   * @param options - A {@link MutationOptions} options object for the mutation.
   * @returns A promise of the mutation's result.
   */
  async mutation(mutation, args, options) {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return await this.client.mutation(getFunctionName(mutation), args, options);
  }
  /**
   * Execute an action function.
   *
   * @param action - A {@link server.FunctionReference} for the public action
   * to run.
   * @param args - An arguments object for the action.
   * @returns A promise of the action's result.
   */
  async action(action, args) {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return await this.client.action(getFunctionName(action), args);
  }
  /**
   * Fetch a query result once.
   *
   * @param query - A {@link server.FunctionReference} for the public query
   * to run.
   * @param args - An arguments object for the query.
   * @returns A promise of the query's result.
   */
  async query(query, args) {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    const value = this.client.localQueryResult(getFunctionName(query), args);
    if (value !== void 0) return Promise.resolve(value);
    return new Promise((resolve, reject) => {
      const { unsubscribe } = this.onUpdate(
        query,
        args,
        (value2) => {
          unsubscribe();
          resolve(value2);
        },
        (e) => {
          unsubscribe();
          reject(e);
        }
      );
    });
  }
  /**
   * Get the current {@link ConnectionState} between the client and the Convex
   * backend.
   *
   * @returns The {@link ConnectionState} with the Convex backend.
   */
  connectionState() {
    if (this.disabled) throw new Error("ConvexClient is disabled");
    return this.client.connectionState();
  }
  /**
   * Subscribe to the {@link ConnectionState} between the client and the Convex
   * backend, calling a callback each time it changes.
   *
   * Subscribed callbacks will be called when any part of ConnectionState changes.
   * ConnectionState may grow in future versions (e.g. to provide a array of
   * inflight requests) in which case callbacks would be called more frequently.
   *
   * @returns An unsubscribe function to stop listening.
   */
  subscribeToConnectionState(cb) {
    if (this.disabled) return () => {
    };
    return this.client.subscribeToConnectionState(cb);
  }
}
//# sourceMappingURL=simple_client.js.map
