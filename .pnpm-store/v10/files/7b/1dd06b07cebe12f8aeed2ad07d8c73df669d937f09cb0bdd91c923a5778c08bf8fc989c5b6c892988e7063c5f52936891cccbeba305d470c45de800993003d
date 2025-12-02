"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/platforms/nodejs.ts
var nodejs_exports = {};
__export(nodejs_exports, {
  FusionAlgorithm: () => FusionAlgorithm,
  Index: () => Index2,
  QueryMode: () => QueryMode,
  WeightingStrategy: () => WeightingStrategy
});
module.exports = __toCommonJS(nodejs_exports);

// src/error/index.ts
var UpstashError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "UpstashError";
  }
};

// src/http/index.ts
var HttpClient = class {
  baseUrl;
  headers;
  options;
  retry;
  constructor(config) {
    this.options = {
      cache: config.cache,
      signal: config.signal
    };
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers
    };
    this.retry = typeof config?.retry === "boolean" && config?.retry === false ? {
      attempts: 1,
      backoff: () => 0
    } : {
      attempts: config?.retry?.retries ?? 5,
      backoff: config?.retry?.backoff ?? ((retryCount) => Math.exp(retryCount) * 50)
    };
  }
  async request(req) {
    const signal = this.options.signal;
    const isSignalFunction = typeof signal === "function";
    const requestOptions = {
      cache: this.options.cache,
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(req.body),
      keepalive: true,
      signal: isSignalFunction ? signal() : signal
    };
    let res = null;
    let error = null;
    for (let i = 0; i <= this.retry.attempts; i++) {
      try {
        res = await fetch([this.baseUrl, ...req.path ?? []].join("/"), requestOptions);
        break;
      } catch (error_) {
        if (requestOptions.signal?.aborted && isSignalFunction) {
          throw error_;
        } else if (requestOptions.signal?.aborted) {
          const myBlob = new Blob([
            JSON.stringify({ result: requestOptions.signal.reason ?? "Aborted" })
          ]);
          const myOptions = {
            status: 200,
            statusText: requestOptions.signal.reason ?? "Aborted"
          };
          res = new Response(myBlob, myOptions);
          break;
        }
        error = error_;
        if (i < this.retry.attempts) {
          await new Promise((r) => setTimeout(r, this.retry.backoff(i)));
        }
      }
    }
    if (!res) {
      throw error ?? new Error("Exhausted all retries");
    }
    const body = await res.json();
    if (!res.ok) {
      throw new UpstashError(`${body.error}`);
    }
    return { result: body.result, error: body.error };
  }
};

// src/commands/command.ts
var Command = class {
  payload;
  endpoint;
  constructor(command, endpoint) {
    this.payload = command;
    this.endpoint = endpoint;
  }
  /**
   * Execute the command using a client.
   */
  async exec(client) {
    const { result, error } = await client.request({
      body: this.payload,
      path: [this.endpoint]
    });
    if (error) {
      throw new UpstashError(error);
    }
    if (result === void 0) {
      throw new TypeError("Request did not return a result");
    }
    return result;
  }
};

// src/commands/client/delete/index.ts
var DeleteCommand = class extends Command {
  constructor(payload, options) {
    let endpoint = "delete";
    if (options?.namespace) {
      endpoint = `${endpoint}/${options.namespace}`;
    }
    if (typeof payload === "string" || typeof payload === "number") {
      super(
        {
          ids: [payload]
        },
        endpoint
      );
    } else if (Array.isArray(payload)) {
      super(
        {
          ids: payload
        },
        endpoint
      );
    } else if (typeof payload === "object") {
      super(payload, endpoint);
    }
  }
};

// src/commands/client/query/query-many/index.ts
var QueryManyCommand = class extends Command {
  constructor(payload, options) {
    let endpoint = "query";
    const hasData = payload.some((p) => p.data);
    endpoint = hasData ? "query-data" : "query";
    if (options?.namespace) {
      endpoint = `${endpoint}/${options.namespace}`;
    }
    super(payload, endpoint);
  }
};

// src/commands/client/query/query-single/index.ts
var QueryCommand = class extends Command {
  constructor(payload, options) {
    let endpoint = "query";
    if ("data" in payload) {
      endpoint = "query-data";
    } else if (!payload.vector && !payload.sparseVector) {
      throw new UpstashError("Either data, vector or sparseVector should be provided.");
    }
    if (options?.namespace) {
      endpoint = `${endpoint}/${options.namespace}`;
    }
    super(payload, endpoint);
  }
};

// src/commands/client/query/types.ts
var WeightingStrategy = /* @__PURE__ */ ((WeightingStrategy2) => {
  WeightingStrategy2["IDF"] = "IDF";
  return WeightingStrategy2;
})(WeightingStrategy || {});
var FusionAlgorithm = /* @__PURE__ */ ((FusionAlgorithm2) => {
  FusionAlgorithm2["RRF"] = "RRF";
  FusionAlgorithm2["DBSF"] = "DBSF";
  return FusionAlgorithm2;
})(FusionAlgorithm || {});
var QueryMode = /* @__PURE__ */ ((QueryMode2) => {
  QueryMode2["HYBRID"] = "HYBRID";
  QueryMode2["DENSE"] = "DENSE";
  QueryMode2["SPARSE"] = "SPARSE";
  return QueryMode2;
})(QueryMode || {});

// src/commands/client/upsert/index.ts
var UpsertCommand = class extends Command {
  constructor(payload, opts) {
    let endpoint = "upsert";
    if (Array.isArray(payload)) {
      const isUpsert = payload.some((p) => isVectorPayload(p));
      endpoint = isUpsert ? "upsert" : "upsert-data";
    } else {
      endpoint = isVectorPayload(payload) ? "upsert" : "upsert-data";
    }
    if (opts?.namespace) {
      endpoint = `${endpoint}/${opts.namespace}`;
    }
    super(payload, endpoint);
  }
};
var isVectorPayload = (payload) => {
  return "vector" in payload || "sparseVector" in payload;
};

// src/commands/client/fetch/index.ts
var FetchCommand = class extends Command {
  constructor([payload, opts]) {
    let endpoint = "fetch";
    if (opts?.namespace) {
      endpoint = `${endpoint}/${opts.namespace}`;
      delete opts.namespace;
    }
    if (Array.isArray(payload)) {
      super({ ids: payload, ...opts }, endpoint);
    } else if (typeof payload === "object") {
      super({ ...payload, ...opts }, endpoint);
    } else {
      throw new Error("Invalid payload");
    }
  }
};

// src/commands/client/range/index.ts
var RangeCommand = class extends Command {
  constructor(payload, options) {
    let endpoint = "range";
    if (options?.namespace) {
      endpoint = `${endpoint}/${options.namespace}`;
    }
    super(payload, endpoint);
  }
};

// src/commands/client/reset/index.ts
var ResetCommand = class extends Command {
  constructor(options) {
    let endpoint = "reset";
    if (options?.namespace) {
      endpoint = `${endpoint}/${options.namespace}`;
    } else if (options?.all) {
      endpoint = `${endpoint}?all`;
    }
    super([], endpoint);
  }
};

// src/commands/client/info/index.ts
var InfoCommand = class extends Command {
  constructor() {
    const endpoint = "info";
    super([], endpoint);
  }
};

// src/commands/client/resumable-query/resume.ts
var ResumeQueryCommand = class extends Command {
  constructor(payload) {
    super(payload, "resumable-query-next");
  }
};

// src/commands/client/resumable-query/start.ts
var StartResumableQueryCommand = class extends Command {
  constructor(payload, namespace) {
    let endpoint = "resumable-query";
    if ("data" in payload) {
      endpoint = "resumable-query-data";
    }
    if (namespace) {
      endpoint = `${endpoint}/${namespace}`;
    }
    super(payload, endpoint);
  }
};

// src/commands/client/resumable-query/stop.ts
var StopResumableQueryCommand = class extends Command {
  constructor(payload) {
    super(payload, "resumable-query-end");
  }
};

// src/commands/client/resumable-query/index.ts
var ResumableQuery = class {
  uuid;
  start;
  fetchNext;
  stop;
  constructor(payload, client, namespace) {
    this.start = async () => {
      const result = await new StartResumableQueryCommand(payload, namespace).exec(
        client
      );
      this.uuid = result.uuid;
      return result;
    };
    this.fetchNext = (additionalK) => {
      if (!this.uuid) {
        throw new Error(
          "The resumable query has already been stopped. Please start another resumable query."
        );
      }
      return new ResumeQueryCommand({ uuid: this.uuid, additionalK }).exec(client);
    };
    this.stop = async () => {
      if (!this.uuid) {
        throw new Error("Resumable query has not been started. Call start() first.");
      }
      const result = await new StopResumableQueryCommand({ uuid: this.uuid }).exec(client);
      this.uuid = "";
      return result;
    };
  }
};

// src/commands/client/namespace/index.ts
var Namespace = class {
  client;
  namespace;
  /**
   * Create a new index namespace client
   *
   * @example
   * ```typescript
   * const index = new Index({
   *  url: "<UPSTASH_VECTOR_REST_URL>",
   *  token: "<UPSTASH_VECTOR_REST_TOKEN>",
   * });
   *
   * const namespace = index.namespace("ns");
   * ```
   */
  constructor(client, namespace) {
    this.client = client;
    this.namespace = namespace;
  }
  /**
   * Upserts (Updates and Inserts) specific items into the index namespace.
   * It's used for adding new items to the index namespace or updating existing ones.
   *
   * @example
   * ```js
   * const upsertArgs = {
   *   id: '123',
   *   vector: [0.42, 0.87, ...],
   *   metadata: { property1: 'value1', property2: 'value2' }
   * };
   * const upsertResult = await index.namespace("ns").upsert(upsertArgs);
   * console.log(upsertResult); // Outputs the result of the upsert operation
   * ```
   *
   * @param {CommandArgs<typeof UpsertCommand>} args - The arguments for the upsert command.
   * @param {number|string} args.id - The unique identifier for the item being upserted.
   * @param {number[]} args.vector - The feature vector associated with the item.
   * @param {Dict} [args.metadata] - Optional metadata to be associated with the item.
   *
   * @returns {string} A promise that resolves with the result of the upsert operation after the command is executed.
   */
  upsert = (args) => new UpsertCommand(args, { namespace: this.namespace }).exec(this.client);
  /*
   * Updates specific items in the index.
   * It's used for updating existing items in the index.
   *
   * @example
   * ```js
   * const updateArgs = {
   *   id: '123',
   *   metadata: { updatedProperty: 'value1' }
   * };
   * const updateResult = await index.update(updateArgs);
   * console.log(updateResult); // Outputs the result of the update operation
   * ```
   *
   * @param {CommandArgs<typeof UpdateCommand>} args - The arguments for the update command.
   * @param {number|string} args.id - The unique identifier for the item being updated.
   * @param {number[]} args.vector - The feature vector associated with the item.
   * @param {Record<string, unknown>} [args.metadata] - Optional metadata to be associated with the item.
   *
   * @returns {Promise<{updated: number}>} A promise that returns the number of items successfully updated.
   */
  update = (args) => new UpdateCommand(args, { namespace: this.namespace }).exec(this.client);
  /**
   * Fetches specific items from the index by their IDs or by an id prefix.
   *
   * Note: While using id prefix, the paginated `range` command is recommended to prevent timeouts on large result sets.
   *
   * @example
   * ```js
   * // Using ids
   * await index.namespace("ns").fetch(["test-1", "test-2"], { includeMetadata: true });
   *
   * // Using id prefix
   * await index.namespace("ns").fetch({ prefix: "test-" });
   * ```
   *
   * @param {...CommandArgs<typeof FetchCommand>} args - The arguments for the fetch command.
   * @param {FetchPayload} args[0] - An array of IDs or the id prefix of the items to be fetched.
   * @param {FetchCommandOptions} args[1] - Options for the fetch operation.
   * @param {boolean} [args[1].includeMetadata=false] - Optionally include metadata of the fetched items.
   * @param {boolean} [args[1].includeVectors=false] - Optionally include feature vectors of the fetched items.
   * @param {string} [args[1].namespace = ""] - The namespace of the index to fetch items from.
   *
   * @returns {Promise<FetchReturnResponse<TMetadata>[]>} A promise that resolves with an array of fetched items or null if not found, after the command is executed.
   */
  fetch = (...args) => {
    if (args[1]) {
      args[1].namespace = this.namespace;
    } else {
      args[1] = { namespace: this.namespace };
    }
    return new FetchCommand(args).exec(this.client);
  };
  /**
   * Queries an index namespace with specified parameters.
   * This method creates and executes a query command on an index based on the provided arguments.
   *
   * @example
   * ```js
   * await index.namespace("ns").query({
   *  topK: 3,
   *  vector: [ 0.22, 0.66 ],
   *  filter: "age >= 23 and (type = \'turtle\' OR type = \'cat\')"
   * });
   * ```
   *
   * @param {Object} args - The arguments for the query command.
   * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
   *                                This vector is utilized to find the most relevant items in the index.
   * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
   * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
   * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
   * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
   *
   * @returns A promise that resolves with an array of query result objects when the request to query the index is completed.
   */
  query = (args) => new QueryCommand(args, { namespace: this.namespace }).exec(this.client);
  /**
   * Initializes a resumable query operation on the vector database.
   * This method allows for querying large result sets in multiple chunks or implementing pagination.
   *
   * @template TMetadata
   * @param {ResumableQueryPayload} args - The arguments for the resumable query.
   * @param {number} args.maxIdle - The maximum idle time in seconds before the query session expires.
   * @param {number} args.topK - The number of top results to return in each fetch operation.
   * @param {number[]} args.vector - The query vector used for similarity search.
   * @param {boolean} [args.includeMetadata] - Whether to include metadata in the query results.
   * @param {boolean} [args.includeVectors] - Whether to include vectors in the query results.
   * @param {Object} [options] - Additional options for the query.
   * @returns {Promise<ResumableQuery<TMetadata>>} A promise that resolves to a ResumableQuery object.
   * @example
   * const { result, fetchNext, stop } = await index.namespace("ns").resumableQuery({
   *   maxIdle: 3600,
   *   topK: 50,
   *   vector: [0.1, 0.2, 0.3, ...],
   *   includeMetadata: true,
   *   includeVectors: true
   * }, { namespace: 'my-namespace' });
   *
   * const firstBatch = await fetchNext(10);
   * const secondBatch = await fetchNext(10);
   * await stop(); // End the query session
   */
  resumableQuery = async (args) => {
    const resumableQuery = new ResumableQuery(args, this.client, this.namespace);
    const initialQuery = await resumableQuery.start();
    const { fetchNext, stop } = resumableQuery;
    return { fetchNext, stop, result: initialQuery.scores };
  };
  /**
     * Deletes items from the index namespace by id, by id prefix, or by filter.
     *
     * @example
     * ```js
     * // Delete by id
     * await index.namespace("ns").delete("test-id");
  
     * // Delete by ids
     * await index.namespace("ns").delete(["test-id1", "test-id2"]);
  
     * // Delete by id prefix
     * await index.namespace("ns").delete({ prefix: "test-" });
  
     * // Delete by filter
     * await index.namespace("ns").delete({ filter: "age >= 23" });
     * ```
     *
     * @param args - A single id, an array of ids, a prefix, or a filter to delete items from the index.
     * @returns Number of deleted vectors in the format `{ deleted: number }`.If no vectors are deleted, returns `{ deleted: 0 }`.
     */
  delete = (args) => new DeleteCommand(args, { namespace: this.namespace }).exec(this.client);
  /**
   * Retrieves a paginated range of items from the index. Optionally filter results by an id prefix.
   * Returns items in batches with a cursor for pagination.
   *
   * @example
   * ```js
   * const args = {
   *   limit: 10,
   *   includeVectors: true,
   *   includeMetadata: false
   * };
   * await index.namespace("ns").range(args);
   *
   * // Use the cursor to get the next page of results
   * const nextPage = await index.namespace("ns").range({
   *   // You have to pass the arguments from the first call
   *   ...args,
   *   cursor: rangeResult.nextCursor,
   * });
   * ```
   *
   * @param {CommandArgs<typeof RangeCommand>} args - The arguments for the range command.
   * @param {string} [args.prefix] - The prefix of the items to be fetched.
   * @param {number|string} args.cursor - The starting point (cursor) for the range query.
   * @param {number} args.limit - The maximum number of items to return in this range.
   * @param {boolean} [args.includeVectors=false] - Optionally include the feature vectors of the items in the response.
   * @param {boolean} [args.includeMetadata=false] - Optionally include additional metadata of the items in the response.
   *
   * @returns {Promise<RangeReturnResponse<TMetadata>>} A promise that resolves with the response containing the next cursor and an array of vectors, after the command is executed.
   */
  range = (args) => new RangeCommand(args, { namespace: this.namespace }).exec(this.client);
  /**
   * It's used for wiping all the vectors in a index namespace.
   *
   * @example
   * ```js
   * await index.namespace("ns").reset();
   * console.log('Index namespace has been reset');
   * ```
   *
   * @returns {Promise<string>} A promise that resolves with the result of the reset operation after the command is executed.
   */
  reset = () => new ResetCommand({ namespace: this.namespace }).exec(this.client);
};

// src/commands/client/update/index.ts
var UpdateCommand = class extends Command {
  constructor(payload, opts) {
    let endpoint = "update";
    if (opts?.namespace) {
      endpoint = `${endpoint}/${opts.namespace}`;
    }
    super(payload, endpoint);
  }
};

// src/commands/management/namespaces/list/index.ts
var ListNamespacesCommand = class extends Command {
  constructor() {
    const endpoint = "list-namespaces";
    super([], endpoint);
  }
};

// src/commands/management/namespaces/delete/index.ts
var DeleteNamespaceCommand = class extends Command {
  constructor(namespace) {
    const endpoint = `delete-namespace/${namespace}`;
    super([], endpoint);
  }
};

// src/vector.ts
var Index = class {
  client;
  /**
   * Create a new vector db client
   *
   * @example
   * ```typescript
   * const index = new Index({
   *  url: "<UPSTASH_VECTOR_REST_URL>",
   *  token: "<UPSTASH_VECTOR_REST_TOKEN>",
   * });
   * ```
   */
  constructor(client) {
    this.client = client;
  }
  namespace = (namespace) => new Namespace(this.client, namespace);
  /**
     * Deletes items from the index by id, by id prefix, or by filter.
     *
     * @example
     * ```js
     * // Delete by id
     * await index.delete("test-id");
  
     * // Delete by ids
     * await index.delete(["test-id1", "test-id2"]);
  
     * // Delete by id prefix
     * await index.delete({ prefix: "test-" });
  
     * // Delete by filter
     * await index.delete({ filter: "age >= 23" });
     * ```
     *
     * @param args - A single id, an array of ids, a prefix, or a filter to delete items from the index.
     * @returns Number of deleted vectors in the format `{ deleted: number }`.If no vectors are deleted, returns `{ deleted: 0 }`.
     */
  delete = (args, options) => new DeleteCommand(args, options).exec(this.client);
  /**
   * Queries an index with specified parameters.
   * This method creates and executes a query command on an index based on the provided arguments.
   *
   * @example
   * ```js
   * await index.query({
   *  topK: 3,
   *  vector: [ 0.22, 0.66 ],
   *  filter: "age >= 23 and (type = \'turtle\' OR type = \'cat\')"
   * });
   * ```
   *
   * @param {Object} args - The arguments for the query command.
   * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
   *                                This vector is utilized to find the most relevant items in the index.
   * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
   * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
   * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
   * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
   * @param {boolean} [args.includeData=false] - When set to true, includes data - string - of the returned items in the response.
   *
   *  A promise that resolves with an array of query result objects when the request to query the index is completed.
   */
  query = (args, options) => new QueryCommand(args, options).exec(this.client);
  /**
   * Queries an index with specified parameters.
   * This method creates and executes a query command on an index based on the provided arguments.
   *
   * @example
   * ```js
   * await index.queryMany([
   * {
   *     topK: 3,
   *     vector: [0.22, 0.66],
   *     filter: "age >= 23 and (type = 'turtle' OR type = 'cat')",
   * },
   * {
   *     topK: 3,
   *     vector: [0.45, 0.52],
   *     filter: "age >= 27 and (type = 'rabbit' OR type = 'dog')",
   * },
   * ]);
   *
   * ```
   *
   * @param {Object} args - The arguments for the query command.
   * @param {number[]} args.vector - An array of numbers representing the feature vector for the query.
   *                                This vector is utilized to find the most relevant items in the index.
   * @param {number} args.topK - The desired number of top results to be returned, based on relevance or similarity to the query vector.
   * @param {string} [args.filter] - An optional filter string to be used in the query. The filter string is used to narrow down the query results.
   * @param {boolean} [args.includeVectors=false] - When set to true, includes the feature vectors of the returned items in the response.
   * @param {boolean} [args.includeMetadata=false] - When set to true, includes additional metadata of the returned items in the response.
   * @param {boolean} [args.includeData=false] - When set to true, includes data - string - of the returned items in the response.
   *
   *  A promise that resolves with an array of arrays of query result objects,
   *  where each inner array represents a group of results matching a specific query condition.
   */
  queryMany = (args, options) => new QueryManyCommand(args, options).exec(this.client);
  /**
   * Initializes a resumable query operation on the vector database.
   * This method allows for querying large result sets in multiple chunks or implementing pagination.
   *
   * @template TMetadata
   * @param {ResumableQueryPayload} args - The arguments for the resumable query.
   * @param {number} args.maxIdle - The maximum idle time in seconds before the query session expires.
   * @param {number} args.topK - The number of top results to return in each fetch operation.
   * @param {number[]} args.vector - The query vector used for similarity search.
   * @param {boolean} [args.includeMetadata] - Whether to include metadata in the query results.
   * @param {boolean} [args.includeVectors] - Whether to include vectors in the query results.
   * @param {Object} [options] - Additional options for the query.
   * @param {string} [options.namespace] - The namespace to query within.
   * @returns {Promise<ResumableQuery<TMetadata>>} A promise that resolves to a ResumableQuery object.
   * @example
   * const { result, fetchNext, stop } = await index.resumableQuery({
   *   maxIdle: 3600,
   *   topK: 50,
   *   vector: [0.1, 0.2, 0.3, ...],
   *   includeMetadata: true,
   *   includeVectors: true
   * }, { namespace: 'my-namespace' });
   *
   * const firstBatch = await fetchNext(10);
   * const secondBatch = await fetchNext(10);
   * await stop(); // End the query session
   */
  resumableQuery = async (args, options) => {
    const resumableQuery = new ResumableQuery(args, this.client, options?.namespace);
    const initialQuery = await resumableQuery.start();
    const { fetchNext, stop } = resumableQuery;
    return { fetchNext, stop, result: initialQuery.scores };
  };
  /**
   * Upserts (Updates and Inserts) specific items into the index.
   * It's used for adding new items to the index or updating existing ones.
   *
   * @example
   * ```js
   * const upsertArgs = {
   *   id: '123',
   *   vector: [0.42, 0.87, ...],
   *   metadata: { property1: 'value1', property2: 'value2' }
   * };
   * const upsertResult = await index.upsert(upsertArgs);
   * console.log(upsertResult); // Outputs the result of the upsert operation
   * ```
   *
   * @param {CommandArgs<typeof UpsertCommand>} args - The arguments for the upsert command.
   * @param {number|string} args.id - The unique identifier for the item being upserted.
   * @param {number[]} args.vector - The feature vector associated with the item.
   * @param {Record<string, unknown>} [args.metadata] - Optional metadata to be associated with the item.
   *
   * @returns {string} A promise that resolves with the result of the upsert operation after the command is executed.
   */
  upsert = (args, options) => new UpsertCommand(args, options).exec(this.client);
  /*
   * Updates specific items in the index.
   * It's used for updating existing items in the index.
   *
   * @example
   * ```js
   * const updateArgs = {
   *   id: '123',
   *   vector: [0.42, 0.87, ...],
   *   metadata: { property1: 'value1', property2: 'value2' }
   * };
   * const updateResult = await index.update(updateArgs);
   * console.log(updateResult); // Outputs the result of the update operation
   * ```
   *
   * @param {CommandArgs<typeof UpdateCommand>} args - The arguments for the update command.
   * @param {number|string} args.id - The unique identifier for the item being updated.
   * @param {number[]} args.vector - The feature vector associated with the item.
   * @param {Record<string, unknown>} [args.metadata] - Optional metadata to be associated with the item.
   * @param {string} [args.namespace] - The namespace to update the item in.
   *
   * @returns {Promise<{updated: number}>} A promise that returns the number of items successfully updated.
   */
  update = (args, options) => new UpdateCommand(args, options).exec(this.client);
  /**
   * Fetches specific items from the index by their IDs or by an id prefix.
   *
   * Note: While using id prefix, the paginated `range` command is recommended to prevent timeouts on large result sets.
   *
   * @example
   * ```js
   * // Using ids
   * await index.fetch(["test-1", "test-2"], { includeMetadata: true });
   *
   * // Using id prefix
   * await index.fetch({ prefix: "test-" });
   * ```
   *
   * @param {...CommandArgs<typeof FetchCommand>} args - The arguments for the fetch command.
   * @param {FetchPayload} args[0] - An array of IDs or the id prefix of the items to be fetched.
   * @param {FetchCommandOptions} args[1] - Options for the fetch operation.
   * @param {boolean} [args[1].includeMetadata=false] - Optionally include metadata of the fetched items.
   * @param {boolean} [args[1].includeVectors=false] - Optionally include feature vectors of the fetched items.
   * @param {string} [args[1].namespace = ""] - The namespace of the index to fetch items from.
   *
   * @returns {Promise<FetchReturnResponse<TMetadata>[]>} A promise that resolves with an array of fetched items or null if not found, after the command is executed.
   */
  fetch = (...args) => new FetchCommand(args).exec(this.client);
  /**
   * It's used for wiping the index.
   *
   * By default, resets the default namespace:
   *
   * @example
   * ```js
   * await index.reset();
   * console.log('Default namespace has been reset');
   * ```
   *
   * To reset a namespace, call reset like:
   *
   * @example
   * ```js
   * await index.reset({ namespace: "ns" });
   * console.log('Namespace ns has been reset');
   * ```
   *
   * If you want to reset all namespaces, call reset like:
   *
   * @example
   * ```js
   * await index.reset({ all: true });
   * console.log('All namespaces have been reset');
   * ```
   *
   * @returns {Promise<string>} A promise that resolves with the result of the reset operation after the command is executed.
   */
  reset = (options) => new ResetCommand(options).exec(this.client);
  /**
   * Retrieves a paginated range of items from the index. Optionally filter results by an id prefix.
   * Returns items in batches with a cursor for pagination.
   *
   * @example
   * ```js
   * const args = {
   *   limit: 10,
   *   includeVectors: true,
   *   includeMetadata: false
   * };
   * await index.range(args);
   *
   * // Use the cursor to get the next page of results
   * const nextPage = await index.range({
   *   // You have to pass the arguments from the first call
   *   ...args,
   *   cursor: rangeResult.nextCursor,
   * });
   * ```
   *
   * @param {CommandArgs<typeof RangeCommand>} args - The arguments for the range command.
   * @param {string} [args.prefix] - The prefix of the items to be fetched.
   * @param {number|string} args.cursor - The starting point (cursor) for the range query.
   * @param {number} args.limit - The maximum number of items to return in this range.
   * @param {boolean} [args.includeVectors=false] - Optionally include the feature vectors of the items in the response.
   * @param {boolean} [args.includeMetadata=false] - Optionally include additional metadata of the items in the response.
   *
   * @returns {Promise<RangeReturnResponse<TMetadata>>} A promise that resolves with the response containing the next cursor and an array of vectors, after the command is executed.
   */
  range = (args, options) => new RangeCommand(args, options).exec(this.client);
  /**
   * Retrieves info from the index.
   *
   * @example
   * ```js
   * const infoResults = await index.info();
   * console.log(infoResults); // Outputs the result of the info operation
   * ```
   *
   * @returns {Promise<InfoResult>} A promise that resolves with the response containing the vectorCount, pendingVectorCount, indexSize, dimension count and similarity algorithm after the command is executed.
   */
  info = () => new InfoCommand().exec(this.client);
  /**
   * List all namespaces in the vector database.
   *
   * @example
   * ```js
   * const namespaces = await index.listNamespaces();
   * console.log(namespaces); // Outputs the list of namespaces
   * ```
   *
   * @returns {Promise<string[]>} A promise that resolves with an array of namespaces after the command is executed.
   */
  listNamespaces = () => new ListNamespacesCommand().exec(this.client);
  /**
   * Deletes a namespace from the vector database.
   *
   * @example
   * ```js
   * await index.deleteNamespace('namespace');
   * console.log('Namespace has been deleted');
   * ```
   *
   * @param {string} namespace - The name of the namespace to be deleted.
   * @returns {Promise<string>} A promise that resolves with the result of the delete operation after the command is executed.
   */
  deleteNamespace = (namespace) => new DeleteNamespaceCommand(namespace).exec(this.client);
};

// version.ts
var VERSION = "v1.2.2";

// src/utils/get-runtime.ts
function getRuntime() {
  if (typeof process === "object" && typeof process.versions == "object" && process.versions.bun)
    return `bun@${process.versions.bun}`;
  return typeof EdgeRuntime === "string" ? "edge-light" : `node@${process.version}`;
}

// src/platforms/nodejs.ts
var Index2 = class _Index extends Index {
  constructor(configOrRequester) {
    if (configOrRequester !== void 0 && "request" in configOrRequester) {
      super(configOrRequester);
      return;
    }
    const token = configOrRequester?.token ?? process.env.NEXT_PUBLIC_UPSTASH_VECTOR_REST_TOKEN ?? process.env.UPSTASH_VECTOR_REST_TOKEN;
    const url = configOrRequester?.url ?? process.env.NEXT_PUBLIC_UPSTASH_VECTOR_REST_URL ?? process.env.UPSTASH_VECTOR_REST_URL;
    if (!token) {
      throw new Error("UPSTASH_VECTOR_REST_TOKEN is missing!");
    }
    if (!url) {
      throw new Error("UPSTASH_VECTOR_REST_URL is missing!");
    }
    if (url.startsWith(" ") || url.endsWith(" ") || /\r|\n/.test(url)) {
      console.warn("The vector url contains whitespace or newline, which can cause errors!");
    }
    if (token.startsWith(" ") || token.endsWith(" ") || /\r|\n/.test(token)) {
      console.warn("The vector token contains whitespace or newline, which can cause errors!");
    }
    const enableTelemetry = process.env.UPSTASH_DISABLE_TELEMETRY ? false : configOrRequester?.enableTelemetry ?? true;
    const telemetryHeaders = enableTelemetry ? {
      "Upstash-Telemetry-Sdk": `upstash-vector-js@${VERSION}`,
      "Upstash-Telemetry-Platform": process.env.VERCEL ? "vercel" : process.env.AWS_REGION ? "aws" : "unknown",
      "Upstash-Telemetry-Runtime": getRuntime()
    } : {};
    const client = new HttpClient({
      baseUrl: url,
      retry: configOrRequester?.retry,
      headers: { authorization: `Bearer ${token}`, ...telemetryHeaders },
      cache: configOrRequester?.cache === false ? void 0 : configOrRequester?.cache || "no-store",
      signal: configOrRequester?.signal
    });
    super(client);
  }
  /**
   * Create a new Upstash Vector instance from environment variables.
   *
   * Use this to automatically load connection secrets from your environment
   * variables. For instance when using the Vercel integration.
   *
   * When used on the Cloudflare Workers, you can just pass the "env" context provided by Cloudflare.
   * Else, this tries to load `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` from
   * your environment using `process.env`.
   */
  static fromEnv(env, config) {
    const url = env?.UPSTASH_VECTOR_REST_URL || process?.env.UPSTASH_VECTOR_REST_URL;
    const token = env?.UPSTASH_VECTOR_REST_TOKEN || process?.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url) {
      throw new Error("Unable to find environment variable: `UPSTASH_VECTOR_REST_URL`");
    }
    if (!token) {
      throw new Error("Unable to find environment variable: `UPSTASH_VECTOR_REST_TOKEN`");
    }
    return new _Index({ ...config, url, token });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FusionAlgorithm,
  Index,
  QueryMode,
  WeightingStrategy
});
