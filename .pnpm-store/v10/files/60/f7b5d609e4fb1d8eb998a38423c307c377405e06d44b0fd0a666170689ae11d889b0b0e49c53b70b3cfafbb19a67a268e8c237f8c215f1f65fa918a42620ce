"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import {
  getFunctionName
} from "../server/api.js";
import { parseArgs, validateDeploymentUrl } from "../common/index.js";
import { version } from "../index.js";
import {
  ConvexError,
  convexToJson,
  jsonToConvex
} from "../values/index.js";
import {
  instantiateDefaultLogger,
  instantiateNoopLogger,
  logForFunction
} from "./logging.js";
export const STATUS_CODE_OK = 200;
export const STATUS_CODE_BAD_REQUEST = 400;
export const STATUS_CODE_UDF_FAILED = 560;
let specifiedFetch = void 0;
export function setFetch(f) {
  specifiedFetch = f;
}
export class ConvexHttpClient {
  /**
   * Create a new {@link ConvexHttpClient}.
   *
   * @param address - The url of your Convex deployment, often provided
   * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
   * @param options - An object of options.
   * - `skipConvexDeploymentUrlCheck` - Skip validating that the Convex deployment URL looks like
   * `https://happy-animal-123.convex.cloud` or localhost. This can be useful if running a self-hosted
   * Convex backend that uses a different URL.
   * - `logger` - A logger or a boolean. If not provided, logs to the console.
   * You can construct your own logger to customize logging to log elsewhere
   * or not log at all, or use `false` as a shorthand for a no-op logger.
   * A logger is an object with 4 methods: log(), warn(), error(), and logVerbose().
   * These methods can receive multiple arguments of any types, like console.log().
   * - `auth` - A JWT containing identity claims accessible in Convex functions.
   * This identity may expire so it may be necessary to call `setAuth()` later,
   * but for short-lived clients it's convenient to specify this value here.
   */
  constructor(address, options) {
    __publicField(this, "address");
    __publicField(this, "auth");
    __publicField(this, "adminAuth");
    __publicField(this, "encodedTsPromise");
    __publicField(this, "debug");
    __publicField(this, "fetchOptions");
    __publicField(this, "logger");
    __publicField(this, "mutationQueue", []);
    __publicField(this, "isProcessingQueue", false);
    if (typeof options === "boolean") {
      throw new Error(
        "skipConvexDeploymentUrlCheck as the second argument is no longer supported. Please pass an options object, `{ skipConvexDeploymentUrlCheck: true }`."
      );
    }
    const opts = options ?? {};
    if (opts.skipConvexDeploymentUrlCheck !== true) {
      validateDeploymentUrl(address);
    }
    this.logger = options?.logger === false ? instantiateNoopLogger({ verbose: false }) : options?.logger !== true && options?.logger ? options.logger : instantiateDefaultLogger({ verbose: false });
    this.address = address;
    this.debug = true;
    this.auth = void 0;
    this.adminAuth = void 0;
    if (options?.auth) {
      this.setAuth(options.auth);
    }
  }
  /**
   * Obtain the {@link ConvexHttpClient}'s URL to its backend.
   * @deprecated Use url, which returns the url without /api at the end.
   *
   * @returns The URL to the Convex backend, including the client's API version.
   */
  backendUrl() {
    return `${this.address}/api`;
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
   * Set the authentication token to be used for subsequent queries and mutations.
   *
   * Should be called whenever the token changes (i.e. due to expiration and refresh).
   *
   * @param value - JWT-encoded OpenID Connect identity token.
   */
  setAuth(value) {
    this.clearAuth();
    this.auth = value;
  }
  /**
   * Set admin auth token to allow calling internal queries, mutations, and actions
   * and acting as an identity.
   *
   * @internal
   */
  setAdminAuth(token, actingAsIdentity) {
    this.clearAuth();
    if (actingAsIdentity !== void 0) {
      const bytes = new TextEncoder().encode(JSON.stringify(actingAsIdentity));
      const actingAsIdentityEncoded = btoa(String.fromCodePoint(...bytes));
      this.adminAuth = `${token}:${actingAsIdentityEncoded}`;
    } else {
      this.adminAuth = token;
    }
  }
  /**
   * Clear the current authentication token if set.
   */
  clearAuth() {
    this.auth = void 0;
    this.adminAuth = void 0;
  }
  /**
   * Sets whether the result log lines should be printed on the console or not.
   *
   * @internal
   */
  setDebug(debug) {
    this.debug = debug;
  }
  /**
   * Used to customize the fetch behavior in some runtimes.
   *
   * @internal
   */
  setFetchOptions(fetchOptions) {
    this.fetchOptions = fetchOptions;
  }
  /**
   * This API is experimental: it may change or disappear.
   *
   * Execute a Convex query function at the same timestamp as every other
   * consistent query execution run by this HTTP client.
   *
   * This doesn't make sense for long-lived ConvexHttpClients as Convex
   * backends can read a limited amount into the past: beyond 30 seconds
   * in the past may not be available.
   *
   * Create a new client to use a consistent time.
   *
   * @param name - The name of the query.
   * @param args - The arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   *
   * @deprecated This API is experimental: it may change or disappear.
   */
  async consistentQuery(query, ...args) {
    const queryArgs = parseArgs(args[0]);
    const timestampPromise = this.getTimestamp();
    return await this.queryInner(query, queryArgs, { timestampPromise });
  }
  async getTimestamp() {
    if (this.encodedTsPromise) {
      return this.encodedTsPromise;
    }
    return this.encodedTsPromise = this.getTimestampInner();
  }
  async getTimestampInner() {
    const localFetch = specifiedFetch || fetch;
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    const response = await localFetch(`${this.address}/api/query_ts`, {
      ...this.fetchOptions,
      method: "POST",
      headers
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const { ts } = await response.json();
    return ts;
  }
  /**
   * Execute a Convex query function.
   *
   * @param name - The name of the query.
   * @param args - The arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   */
  async query(query, ...args) {
    const queryArgs = parseArgs(args[0]);
    return await this.queryInner(query, queryArgs, {});
  }
  async queryInner(query, queryArgs, options) {
    const name = getFunctionName(query);
    const args = [convexToJson(queryArgs)];
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = specifiedFetch || fetch;
    const timestamp = options.timestampPromise ? await options.timestampPromise : void 0;
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args,
      ...timestamp ? { ts: timestamp } : {}
    });
    const endpoint = timestamp ? `${this.address}/api/query_at_ts` : `${this.address}/api/query`;
    const response = await localFetch(endpoint, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "query", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  async mutationInner(mutation, mutationArgs) {
    const name = getFunctionName(mutation);
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args: [convexToJson(mutationArgs)]
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/mutation`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "mutation", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  async processMutationQueue() {
    if (this.isProcessingQueue) {
      return;
    }
    this.isProcessingQueue = true;
    while (this.mutationQueue.length > 0) {
      const { mutation, args, resolve, reject } = this.mutationQueue.shift();
      try {
        const result = await this.mutationInner(mutation, args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessingQueue = false;
  }
  enqueueMutation(mutation, args) {
    return new Promise((resolve, reject) => {
      this.mutationQueue.push({ mutation, args, resolve, reject });
      void this.processMutationQueue();
    });
  }
  /**
   * Execute a Convex mutation function. Mutations are queued by default.
   *
   * @param name - The name of the mutation.
   * @param args - The arguments object for the mutation. If this is omitted,
   * the arguments will be `{}`.
   * @param options - An optional object containing
   * @returns A promise of the mutation's result.
   */
  async mutation(mutation, ...args) {
    const [fnArgs, options] = args;
    const mutationArgs = parseArgs(fnArgs);
    const queued = !options?.skipQueue;
    if (queued) {
      return await this.enqueueMutation(mutation, mutationArgs);
    } else {
      return await this.mutationInner(mutation, mutationArgs);
    }
  }
  /**
   * Execute a Convex action function. Actions are not queued.
   *
   * @param name - The name of the action.
   * @param args - The arguments object for the action. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the action's result.
   */
  async action(action, ...args) {
    const actionArgs = parseArgs(args[0]);
    const name = getFunctionName(action);
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args: [convexToJson(actionArgs)]
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/action`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "action", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  /**
   * Execute a Convex function of an unknown type. These function calls are not queued.
   *
   * @param name - The name of the function.
   * @param args - The arguments object for the function. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the function's result.
   *
   * @internal
   */
  async function(anyFunction, componentPath, ...args) {
    const functionArgs = parseArgs(args[0]);
    const name = typeof anyFunction === "string" ? anyFunction : getFunctionName(anyFunction);
    const body = JSON.stringify({
      componentPath,
      path: name,
      format: "convex_encoded_json",
      args: convexToJson(functionArgs)
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/function`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "any", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
}
function forwardErrorData(errorData, error) {
  error.data = jsonToConvex(errorData);
  return error;
}
//# sourceMappingURL=http_client.js.map
