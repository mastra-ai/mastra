"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Index = void 0;
var upsert_1 = require("./upsert");
var fetch_1 = require("./fetch");
var update_1 = require("./update");
var query_1 = require("./query");
var deleteOne_1 = require("./deleteOne");
var deleteMany_1 = require("./deleteMany");
var deleteAll_1 = require("./deleteAll");
var describeIndexStats_1 = require("./describeIndexStats");
var dataOperationsProvider_1 = require("./dataOperationsProvider");
var list_1 = require("./list");
/**
 * The `Index` class is used to perform data operations (upsert, query, etc)
 * against Pinecone indexes. Typically it will be instantiated via a `Pinecone`
 * client instance that has already built the required configuration from a
 * combination of sources.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 * const pc = new Pinecone()
 *
 * const index = pc.index('index-name')
 * ```
 *
 * ### Targeting an index, with user-defined Metadata types
 *
 * If you are storing metadata alongside your vector values inside your Pinecone records, you can pass a type parameter to `index()` in order to get proper TypeScript typechecking when upserting and querying data.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 * const pc = new Pinecone();
 *
 * type MovieMetadata = {
 *   title: string,
 *   runtime: numbers,
 *   genre: 'comedy' | 'horror' | 'drama' | 'action'
 * }
 *
 * // Specify a custom metadata type while targeting the index
 * const index = pc.index<MovieMetadata>('test-index');
 *
 * // Now you get type errors if upserting malformed metadata
 * await index.upsert([{
 *   id: '1234',
 *   values: [
 *     .... // embedding values
 *   ],
 *   metadata: {
 *     genre: 'Gone with the Wind',
 *     runtime: 238,
 *     genre: 'drama',
 *
 *     // @ts-expect-error because category property not in MovieMetadata
 *     category: 'classic'
 *   }
 * }])
 *
 * const results = await index.query({
 *    vector: [
 *     ... // query embedding
 *    ],
 *    filter: { genre: { '$eq': 'drama' }}
 * })
 * const movie = results.matches[0];
 *
 * if (movie.metadata) {
 *   // Since we passed the MovieMetadata type parameter above,
 *   // we can interact with metadata fields without having to
 *   // do any typecasting.
 *   const { title, runtime, genre } = movie.metadata;
 *   console.log(`The best match in drama was ${title}`)
 * }
 * ```
 *
 * @typeParam T - The type of metadata associated with each record.
 */
var Index = /** @class */ (function () {
    /**
     * Instantiation of Index is handled by {@link Pinecone}
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const index = pc.index('my-index');
     * ```
     *
     * @constructor
     * @param indexName - The name of the index that will receive operations from this {@link Index} instance.
     * @param config - The configuration from the Pinecone client.
     * @param namespace - The namespace for the index.
     * @param indexHostUrl - An optional override for the host address used for data operations.
     * @param additionalHeaders - An optional object of additional header to send with each request.
     */
    function Index(indexName, config, namespace, indexHostUrl, additionalHeaders) {
        if (namespace === void 0) { namespace = ''; }
        this.config = config;
        this.target = {
            index: indexName,
            namespace: namespace,
            indexHostUrl: indexHostUrl,
        };
        var apiProvider = new dataOperationsProvider_1.DataOperationsProvider(config, indexName, indexHostUrl, additionalHeaders);
        this._deleteAll = (0, deleteAll_1.deleteAll)(apiProvider, namespace);
        this._deleteMany = (0, deleteMany_1.deleteMany)(apiProvider, namespace);
        this._deleteOne = (0, deleteOne_1.deleteOne)(apiProvider, namespace);
        this._describeIndexStats = (0, describeIndexStats_1.describeIndexStats)(apiProvider);
        this._listPaginated = (0, list_1.listPaginated)(apiProvider, namespace);
        this._fetchCommand = new fetch_1.FetchCommand(apiProvider, namespace);
        this._queryCommand = new query_1.QueryCommand(apiProvider, namespace);
        this._updateCommand = new update_1.UpdateCommand(apiProvider, namespace);
        this._upsertCommand = new upsert_1.UpsertCommand(apiProvider, namespace);
    }
    /**
     * Delete all records from the targeted namespace. To delete all records from across all namespaces,
     * delete the index using {@link Pinecone.deleteIndex} and create a new one using {@link Pinecone.createIndex}.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //    '': { recordCount: 10 },
     * //   foo: { recordCount: 1 }
     * //   },
     * //   dimension: 8,
     * //   indexFullness: 0,
     * //   totalRecordCount: 11
     * // }
     *
     * await index.deleteAll();
     *
     * // Records from namespace 'foo' are now deleted. Records in other namespaces are not modified.
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //   foo: { recordCount: 1 }
     * //   },
     * //   dimension: 8,
     * //   indexFullness: 0,
     * //   totalRecordCount: 1
     * // }
     *
     * await index.deleteAll();
     * // Since no namespace was specified, records in default namespace '' are now deleted.
     *
     * ```
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    Index.prototype.deleteAll = function () {
        return this._deleteAll();
    };
    /**
     * Delete records from the index by either an array of ids, or a filter object.
     * See [Filtering with metadata](https://docs.pinecone.io/docs/metadata-filtering#deleting-vectors-by-metadata-filter)
     * for more on deleting records with filters.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.deleteMany(['record-1', 'record-2']);
     *
     * // or
     * await index.deleteMany({ genre: 'classical' });
     * ```
     * @param options - An array of record id values or a filter object.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    Index.prototype.deleteMany = function (options) {
        return this._deleteMany(options);
    };
    /**
     * Delete a record from the index by id.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.deleteOne('record-1');
     * ```
     * @param id - The id of the record to delete.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the delete is completed.
     */
    Index.prototype.deleteOne = function (id) {
        return this._deleteOne(id);
    };
    /**
     * Describes the index's statistics such as total number of records, records per namespace, and the index's dimension size.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.describeIndexStats();
     * // {
     * //  namespaces: {
     * //    '': { recordCount: 10 }
     * //    foo: { recordCount: 2000 },
     * //    bar: { recordCount: 2000 }
     * //   },
     * //   dimension: 1536,
     * //   indexFullness: 0,
     * //   totalRecordCount: 4010
     * // }
     * ```
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link IndexStatsDescription} value when the operation is completed.
     */
    Index.prototype.describeIndexStats = function () {
        return this._describeIndexStats();
    };
    /**
     * The `listPaginated` operation finds vectors based on an id prefix within a single namespace.
     * It returns matching ids in a paginated form, with a pagination token to fetch the next page of results.
     * This id list can then be passed to fetch or delete options to perform operations on the matching records.
     * See [Get record IDs](https://docs.pinecone.io/docs/get-record-ids) for guidance and examples.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const index = pc.index('my-index').namespace('my-namespace');
     *
     * const results = await index.listPaginated({ prefix: 'doc1#' });
     * console.log(results);
     * // {
     * //   vectors: [
     * //     { id: 'doc1#01' }, { id: 'doc1#02' }, { id: 'doc1#03' },
     * //     { id: 'doc1#04' }, { id: 'doc1#05' },  { id: 'doc1#06' },
     * //     { id: 'doc1#07' }, { id: 'doc1#08' }, { id: 'doc1#09' },
     * //     ...
     * //   ],
     * //   pagination: {
     * //     next: 'eyJza2lwX3Bhc3QiOiJwcmVUZXN0LS04MCIsInByZWZpeCI6InByZVRlc3QifQ=='
     * //   },
     * //   namespace: 'my-namespace',
     * //   usage: { readUnits: 1 }
     * // }
     *
     * // Fetch the next page of results
     * await index.listPaginated({ prefix: 'doc1#', paginationToken: results.pagination.next});
     * ```
     *
     * > ⚠️ **Note:**
     * >
     * > `listPaginated` is supported only for serverless indexes.
     *
     * @param options - The {@link ListOptions} for the operation.
     * @returns - A promise that resolves with the {@link ListResponse} when the operation is completed.
     * @throws {@link Errors.PineconeConnectionError} when invalid environment, project id, or index name is configured.
     * @throws {@link Errors.PineconeArgumentError} when invalid arguments are passed.
     */
    Index.prototype.listPaginated = function (options) {
        return this._listPaginated(options);
    };
    /**
     * Returns an {@link Index} targeting the specified namespace. By default, all operations take place inside the default namespace `''`.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * // Create an Index client instance scoped to operate on a
     * // single namespace
     * const ns = pc.index('my-index').namespace('my-namespace');
     *
     * // Now operations against this intance only affect records in
     * // the targeted namespace
     * ns.upsert([
     *   // ... records to upsert in namespace 'my-namespace'
     * ])
     *
     * ns.query({
     *   // ... query records in namespace 'my-namespace'
     * })
     * ```
     * This `namespace()` method will inherit custom metadata types if you are chaining the call off an {@link Index} client instance that is typed with a user-specified metadata type. See {@link Pinecone.index} for more info.
     *
     * @param namespace - The namespace to target within the index. All operations performed with the returned client instance will be scoped only to the targeted namespace.
     * @returns An {@link Index} object that can be used to perform data operations scoped to the specified namespace.
     */
    Index.prototype.namespace = function (namespace) {
        return new Index(this.target.index, this.config, namespace, this.target.indexHostUrl);
    };
    /**
     * Upsert records to the index.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.upsert([{
     *  id: 'record-1',
     *  values: [0.176, 0.345, 0.263],
     * },{
     *  id: 'record-2',
     *  values: [0.176, 0.345, 0.263],
     * }])
     * ```
     *
     * @param data - An array of {@link PineconeRecord} objects to upsert.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the upsert is completed.
     */
    Index.prototype.upsert = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._upsertCommand.run(data)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Fetch records from the index.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.fetch(['record-1', 'record-2']);
     * ```
     * @param options - The {@link FetchOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link FetchResponse} when the fetch is completed.
     */
    Index.prototype.fetch = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._fetchCommand.run(options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Query records from the index. Query is used to find the `topK` records in the index whose vector values are most
     * similar to the vector values of the query according to the distance metric you have configured for your index.
     * See [Query data](https://docs.pinecone.io/docs/query-data) for more on querying.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('my-index');
     *
     * await index.query({ topK: 3, id: 'record-1'});
     *
     * // or
     * await index.query({ topK: 3, vector: [0.176, 0.345, 0.263] });
     * ```
     *
     * @param options - The {@link QueryOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves with the {@link QueryResponse} when the query is completed.
     */
    Index.prototype.query = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._queryCommand.run(options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Update a record in the index by id.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     * const index = pc.index('imdb-movies');
     *
     * await index.update({
     *   id: '18593',
     *   metadata: { genre: 'romance' },
     * });
     * ```
     *
     * @param options - The {@link UpdateOptions} for the operation.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the update is completed.
     */
    Index.prototype.update = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._updateCommand.run(options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return Index;
}());
exports.Index = Index;
//# sourceMappingURL=index.js.map