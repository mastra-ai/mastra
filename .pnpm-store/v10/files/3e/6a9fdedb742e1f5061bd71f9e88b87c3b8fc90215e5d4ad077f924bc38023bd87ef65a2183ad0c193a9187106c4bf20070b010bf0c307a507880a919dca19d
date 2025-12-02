"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var client_exports = {};
__export(client_exports, {
  ConvexProvider: () => ConvexProvider,
  ConvexReactClient: () => ConvexReactClient,
  createMutation: () => createMutation,
  useAction: () => useAction,
  useConvex: () => useConvex,
  useConvexConnectionState: () => useConvexConnectionState,
  useMutation: () => useMutation,
  useQuery: () => useQuery
});
module.exports = __toCommonJS(client_exports);
var import_browser = require("../browser/index.js");
var import_react = __toESM(require("react"), 1);
var import_values = require("../values/index.js");
var import_use_queries = require("./use_queries.js");
var import_use_subscription = require("./use_subscription.js");
var import_common = require("../common/index.js");
var import_api = require("../server/api.js");
var import_logging = require("../browser/logging.js");
const DEFAULT_EXTEND_SUBSCRIPTION_FOR = 5e3;
if (typeof import_react.default === "undefined") {
  throw new Error("Required dependency 'react' not found");
}
function createMutation(mutationReference, client, update) {
  function mutation(args) {
    assertNotAccidentalArgument(args);
    return client.mutation(mutationReference, args, {
      optimisticUpdate: update
    });
  }
  mutation.withOptimisticUpdate = function withOptimisticUpdate(optimisticUpdate) {
    if (update !== void 0) {
      throw new Error(
        `Already specified optimistic update for mutation ${(0, import_api.getFunctionName)(
          mutationReference
        )}`
      );
    }
    return createMutation(mutationReference, client, optimisticUpdate);
  };
  return mutation;
}
function createAction(actionReference, client) {
  return function(args) {
    return client.action(actionReference, args);
  };
}
class ConvexReactClient {
  /**
   * @param address - The url of your Convex deployment, often provided
   * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
   * @param options - See {@link ConvexReactClientOptions} for a full description.
   */
  constructor(address, options) {
    __publicField(this, "address");
    __publicField(this, "cachedSync");
    __publicField(this, "listeners");
    __publicField(this, "options");
    __publicField(this, "closed", false);
    __publicField(this, "_logger");
    __publicField(this, "adminAuth");
    __publicField(this, "fakeUserIdentity");
    if (address === void 0) {
      throw new Error(
        "No address provided to ConvexReactClient.\nIf trying to deploy to production, make sure to follow all the instructions found at https://docs.convex.dev/production/hosting/\nIf running locally, make sure to run `convex dev` and ensure the .env.local file is populated."
      );
    }
    if (typeof address !== "string") {
      throw new Error(
        `ConvexReactClient requires a URL like 'https://happy-otter-123.convex.cloud', received something of type ${typeof address} instead.`
      );
    }
    if (!address.includes("://")) {
      throw new Error("Provided address was not an absolute URL.");
    }
    this.address = address;
    this.listeners = /* @__PURE__ */ new Map();
    this._logger = options?.logger === false ? (0, import_logging.instantiateNoopLogger)({ verbose: options?.verbose ?? false }) : options?.logger !== true && options?.logger ? options.logger : (0, import_logging.instantiateDefaultLogger)({ verbose: options?.verbose ?? false });
    this.options = { ...options, logger: this._logger };
  }
  /**
   * Return the address for this client, useful for creating a new client.
   *
   * Not guaranteed to match the address with which this client was constructed:
   * it may be canonicalized.
   */
  get url() {
    return this.address;
  }
  /**
   * Lazily instantiate the `BaseConvexClient` so we don't create the WebSocket
   * when server-side rendering.
   *
   * @internal
   */
  get sync() {
    if (this.closed) {
      throw new Error("ConvexReactClient has already been closed.");
    }
    if (this.cachedSync) {
      return this.cachedSync;
    }
    this.cachedSync = new import_browser.BaseConvexClient(
      this.address,
      (updatedQueries) => this.transition(updatedQueries),
      this.options
    );
    if (this.adminAuth) {
      this.cachedSync.setAdminAuth(this.adminAuth, this.fakeUserIdentity);
    }
    return this.cachedSync;
  }
  /**
   * Set the authentication token to be used for subsequent queries and mutations.
   * `fetchToken` will be called automatically again if a token expires.
   * `fetchToken` should return `null` if the token cannot be retrieved, for example
   * when the user's rights were permanently revoked.
   * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
   * @param onChange - a callback that will be called when the authentication status changes
   */
  setAuth(fetchToken, onChange) {
    if (typeof fetchToken === "string") {
      throw new Error(
        "Passing a string to ConvexReactClient.setAuth is no longer supported, please upgrade to passing in an async function to handle reauthentication."
      );
    }
    this.sync.setAuth(
      fetchToken,
      onChange ?? (() => {
      })
    );
  }
  /**
   * Clear the current authentication token if set.
   */
  clearAuth() {
    this.sync.clearAuth();
  }
  /**
   * @internal
   */
  setAdminAuth(token, identity) {
    this.adminAuth = token;
    this.fakeUserIdentity = identity;
    if (this.closed) {
      throw new Error("ConvexReactClient has already been closed.");
    }
    if (this.cachedSync) {
      this.sync.setAdminAuth(token, identity);
    }
  }
  /**
   * Construct a new {@link Watch} on a Convex query function.
   *
   * **Most application code should not call this method directly. Instead use
   * the {@link useQuery} hook.**
   *
   * @param query - A {@link server.FunctionReference} for the public query to run.
   * @param args - An arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @param options - A {@link WatchQueryOptions} options object for this query.
   *
   * @returns The {@link Watch} object.
   */
  watchQuery(query, ...argsAndOptions) {
    const [args, options] = argsAndOptions;
    const name = (0, import_api.getFunctionName)(query);
    return {
      onUpdate: (callback) => {
        const { queryToken, unsubscribe } = this.sync.subscribe(
          name,
          args,
          options
        );
        const currentListeners = this.listeners.get(queryToken);
        if (currentListeners !== void 0) {
          currentListeners.add(callback);
        } else {
          this.listeners.set(queryToken, /* @__PURE__ */ new Set([callback]));
        }
        return () => {
          if (this.closed) {
            return;
          }
          const currentListeners2 = this.listeners.get(queryToken);
          currentListeners2.delete(callback);
          if (currentListeners2.size === 0) {
            this.listeners.delete(queryToken);
          }
          unsubscribe();
        };
      },
      localQueryResult: () => {
        if (this.cachedSync) {
          return this.cachedSync.localQueryResult(name, args);
        }
        return void 0;
      },
      localQueryLogs: () => {
        if (this.cachedSync) {
          return this.cachedSync.localQueryLogs(name, args);
        }
        return void 0;
      },
      journal: () => {
        if (this.cachedSync) {
          return this.cachedSync.queryJournal(name, args);
        }
        return void 0;
      }
    };
  }
  // Let's try out a queryOptions-style API.
  // This method is similar to the React Query API `queryClient.prefetchQuery()`.
  // In the future an ensureQueryData(): Promise<Data> method could exist.
  /**
   * Indicates likely future interest in a query subscription.
   *
   * The implementation currently immediately subscribes to a query. In the future this method
   * may prioritize some queries over others, fetch the query result without subscribing, or
   * do nothing in slow network connections or high load scenarios.
   *
   * To use this in a React component, call useQuery() and ignore the return value.
   *
   * @param queryOptions - A query (function reference from an api object) and its args, plus
   * an optional extendSubscriptionFor for how long to subscribe to the query.
   */
  prewarmQuery(queryOptions) {
    const extendSubscriptionFor = queryOptions.extendSubscriptionFor ?? DEFAULT_EXTEND_SUBSCRIPTION_FOR;
    const watch = this.watchQuery(queryOptions.query, queryOptions.args || {});
    const unsubscribe = watch.onUpdate(() => {
    });
    setTimeout(unsubscribe, extendSubscriptionFor);
  }
  /**
   * Execute a mutation function.
   *
   * @param mutation - A {@link server.FunctionReference} for the public mutation
   * to run.
   * @param args - An arguments object for the mutation. If this is omitted,
   * the arguments will be `{}`.
   * @param options - A {@link MutationOptions} options object for the mutation.
   * @returns A promise of the mutation's result.
   */
  mutation(mutation, ...argsAndOptions) {
    const [args, options] = argsAndOptions;
    const name = (0, import_api.getFunctionName)(mutation);
    return this.sync.mutation(name, args, options);
  }
  /**
   * Execute an action function.
   *
   * @param action - A {@link server.FunctionReference} for the public action
   * to run.
   * @param args - An arguments object for the action. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the action's result.
   */
  action(action, ...args) {
    const name = (0, import_api.getFunctionName)(action);
    return this.sync.action(name, ...args);
  }
  /**
   * Fetch a query result once.
   *
   * **Most application code should subscribe to queries instead, using
   * the {@link useQuery} hook.**
   *
   * @param query - A {@link server.FunctionReference} for the public query
   * to run.
   * @param args - An arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   */
  query(query, ...args) {
    const watch = this.watchQuery(query, ...args);
    const existingResult = watch.localQueryResult();
    if (existingResult !== void 0) {
      return Promise.resolve(existingResult);
    }
    return new Promise((resolve, reject) => {
      const unsubscribe = watch.onUpdate(() => {
        unsubscribe();
        try {
          resolve(watch.localQueryResult());
        } catch (e) {
          reject(e);
        }
      });
    });
  }
  /**
   * Get the current {@link ConnectionState} between the client and the Convex
   * backend.
   *
   * @returns The {@link ConnectionState} with the Convex backend.
   */
  connectionState() {
    return this.sync.connectionState();
  }
  /**
   * Subscribe to the {@link ConnectionState} between the client and the Convex
   * backend, calling a callback each time it changes.
   *
   * Subscribed callbacks will be called when any part of ConnectionState changes.
   * ConnectionState may grow in future versions (e.g. to provide a array of
   * inflight requests) in which case callbacks would be called more frequently.
   * ConnectionState may also *lose* properties in future versions as we figure
   * out what information is most useful. As such this API is considered unstable.
   *
   * @returns An unsubscribe function to stop listening.
   */
  subscribeToConnectionState(cb) {
    return this.sync.subscribeToConnectionState(cb);
  }
  /**
   * Get the logger for this client.
   *
   * @returns The {@link Logger} for this client.
   */
  get logger() {
    return this._logger;
  }
  /**
   * Close any network handles associated with this client and stop all subscriptions.
   *
   * Call this method when you're done with a {@link ConvexReactClient} to
   * dispose of its sockets and resources.
   *
   * @returns A `Promise` fulfilled when the connection has been completely closed.
   */
  async close() {
    this.closed = true;
    this.listeners = /* @__PURE__ */ new Map();
    if (this.cachedSync) {
      const sync = this.cachedSync;
      this.cachedSync = void 0;
      await sync.close();
    }
  }
  transition(updatedQueries) {
    for (const queryToken of updatedQueries) {
      const callbacks = this.listeners.get(queryToken);
      if (callbacks) {
        for (const callback of callbacks) {
          callback();
        }
      }
    }
  }
}
const ConvexContext = import_react.default.createContext(
  void 0
  // in the future this will be a mocked client for testing
);
function useConvex() {
  return (0, import_react.useContext)(ConvexContext);
}
const ConvexProvider = ({ client, children }) => {
  return import_react.default.createElement(
    ConvexContext.Provider,
    { value: client },
    children
  );
};
function useQuery(query, ...args) {
  const skip = args[0] === "skip";
  const argsObject = args[0] === "skip" ? {} : (0, import_common.parseArgs)(args[0]);
  const queryReference = typeof query === "string" ? (0, import_api.makeFunctionReference)(query) : query;
  const queryName = (0, import_api.getFunctionName)(queryReference);
  const queries = (0, import_react.useMemo)(
    () => skip ? {} : { query: { query: queryReference, args: argsObject } },
    // Stringify args so args that are semantically the same don't trigger a
    // rerender. Saves developers from adding `useMemo` on every args usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((0, import_values.convexToJson)(argsObject)), queryName, skip]
  );
  const results = (0, import_use_queries.useQueries)(queries);
  const result = results["query"];
  if (result instanceof Error) {
    throw result;
  }
  return result;
}
function useMutation(mutation) {
  const mutationReference = typeof mutation === "string" ? (0, import_api.makeFunctionReference)(mutation) : mutation;
  const convex = (0, import_react.useContext)(ConvexContext);
  if (convex === void 0) {
    throw new Error(
      "Could not find Convex client! `useMutation` must be used in the React component tree under `ConvexProvider`. Did you forget it? See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app"
    );
  }
  return (0, import_react.useMemo)(
    () => createMutation(mutationReference, convex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convex, (0, import_api.getFunctionName)(mutationReference)]
  );
}
function useAction(action) {
  const convex = (0, import_react.useContext)(ConvexContext);
  const actionReference = typeof action === "string" ? (0, import_api.makeFunctionReference)(action) : action;
  if (convex === void 0) {
    throw new Error(
      "Could not find Convex client! `useAction` must be used in the React component tree under `ConvexProvider`. Did you forget it? See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app"
    );
  }
  return (0, import_react.useMemo)(
    () => createAction(actionReference, convex),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [convex, (0, import_api.getFunctionName)(actionReference)]
  );
}
function useConvexConnectionState() {
  const convex = (0, import_react.useContext)(ConvexContext);
  if (convex === void 0) {
    throw new Error(
      "Could not find Convex client! `useConvexConnectionState` must be used in the React component tree under `ConvexProvider`. Did you forget it? See https://docs.convex.dev/quick-start#set-up-convex-in-your-react-app"
    );
  }
  const getCurrentValue = (0, import_react.useCallback)(() => {
    return convex.connectionState();
  }, [convex]);
  const subscribe = (0, import_react.useCallback)(
    (callback) => {
      return convex.subscribeToConnectionState(() => {
        callback();
      });
    },
    [convex]
  );
  return (0, import_use_subscription.useSubscription)({ getCurrentValue, subscribe });
}
function assertNotAccidentalArgument(value) {
  if (typeof value === "object" && value !== null && "bubbles" in value && "persist" in value && "isDefaultPrevented" in value) {
    throw new Error(
      `Convex function called with SyntheticEvent object. Did you use a Convex function as an event handler directly? Event handlers like onClick receive an event object as their first argument. These SyntheticEvent objects are not valid Convex values. Try wrapping the function like \`const handler = () => myMutation();\` and using \`handler\` in the event handler.`
    );
  }
}
//# sourceMappingURL=client.js.map
