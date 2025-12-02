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
exports.Pinecone = void 0;
var control_1 = require("./control");
var indexHostSingleton_1 = require("./data/indexHostSingleton");
var errors_1 = require("./errors");
var data_1 = require("./data");
var inference_1 = require("./inference");
var inferenceOperationsBuilder_1 = require("./inference/inferenceOperationsBuilder");
var environment_1 = require("./utils/environment");
var validateProperties_1 = require("./utils/validateProperties");
var types_1 = require("./data/types");
/**
 * The `Pinecone` class is the main entrypoint to this sdk. You will use
 * instances of it to create and manage indexes as well as perform data
 * operations on those indexes after they are created.
 *
 * ### Initializing the client
 *
 * There is one piece of configuration required to use the Pinecone client: an API key. This value can be passed using environment variables or in code through a configuration object. Find your API key in the console dashboard at [https://app.pinecone.io](https://app.pinecone.io)
 *
 * ### Using environment variables
 *
 * The environment variables used to configure the client are the following:
 *
 * ```bash
 * export PINECONE_API_KEY="your_api_key"
 * export PINECONE_CONTROLLER_HOST="your_controller_host"
 * ```
 *
 * When these environment variables are set, the client constructor does not require any additional arguments.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 *
 * const pc = new Pinecone();
 * ```
 *
 * ### Using a configuration object
 *
 * If you prefer to pass configuration in code, the constructor accepts a config object containing the `apiKey` and `environment` values. This
 * could be useful if your application needs to interact with multiple projects, each with a different configuration.
 *
 * ```typescript
 * import { Pinecone } from '@pinecone-database/pinecone';
 *
 * const pc = new Pinecone({
 *   apiKey: 'your_api_key',
 * });
 *
 * ```
 *
 * See {@link PineconeConfiguration} for a full description of available configuration options.
 */
var Pinecone = /** @class */ (function () {
    /**
     * @example
     * ```
     * import { Pinecone } from '@pinecone-database/pinecone';
     *
     * const pc = new Pinecone({
     *  apiKey: 'my-api-key',
     * });
     * ```
     *
     * @constructor
     * @param options - The configuration options for the Pinecone client: {@link PineconeConfiguration}.
     */
    function Pinecone(options) {
        if (options === undefined) {
            options = this._readEnvironmentConfig();
        }
        if (!options.apiKey) {
            throw new errors_1.PineconeConfigurationError('The client configuration must have required property: apiKey.');
        }
        (0, validateProperties_1.ValidateProperties)(options, types_1.PineconeConfigurationProperties);
        this.config = options;
        this._checkForBrowser();
        var api = (0, control_1.indexOperationsBuilder)(this.config);
        var infApi = (0, inferenceOperationsBuilder_1.inferenceOperationsBuilder)(this.config);
        this._configureIndex = (0, control_1.configureIndex)(api);
        this._createCollection = (0, control_1.createCollection)(api);
        this._createIndex = (0, control_1.createIndex)(api);
        this._describeCollection = (0, control_1.describeCollection)(api);
        this._deleteCollection = (0, control_1.deleteCollection)(api);
        this._describeIndex = (0, control_1.describeIndex)(api);
        this._deleteIndex = (0, control_1.deleteIndex)(api);
        this._listCollections = (0, control_1.listCollections)(api);
        this._listIndexes = (0, control_1.listIndexes)(api);
        this.inference = new inference_1.Inference(infApi);
    }
    /**
     * @internal
     * This method is used by {@link Pinecone.constructor} to read configuration from environment variables.
     *
     * It looks for the following environment variables:
     * - `PINECONE_API_KEY`
     * - `PINECONE_CONTROLLER_HOST`
     *
     * @returns A {@link PineconeConfiguration} object populated with values found in environment variables.
     */
    Pinecone.prototype._readEnvironmentConfig = function () {
        if (typeof process === 'undefined' || !process || !process.env) {
            throw new errors_1.PineconeEnvironmentVarsNotSupportedError('Your execution environment does not support reading environment variables from process.env, so a' +
                ' configuration object is required when calling new Pinecone().');
        }
        var environmentConfig = {};
        var requiredEnvVarMap = {
            apiKey: 'PINECONE_API_KEY',
        };
        var missingVars = [];
        for (var _i = 0, _a = Object.entries(requiredEnvVarMap); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], envVar = _b[1];
            var value = process.env[envVar] || '';
            if (!value) {
                missingVars.push(envVar);
            }
            environmentConfig[key] = value;
        }
        if (missingVars.length > 0) {
            throw new errors_1.PineconeConfigurationError("Since you called 'new Pinecone()' with no configuration object, we attempted to find client configuration in environment variables but the required environment variables were not set. Missing variables: ".concat(missingVars.join(', '), "."));
        }
        var optionalEnvVarMap = {
            controllerHostUrl: 'PINECONE_CONTROLLER_HOST',
        };
        for (var _c = 0, _d = Object.entries(optionalEnvVarMap); _c < _d.length; _c++) {
            var _e = _d[_c], key = _e[0], envVar = _e[1];
            var value = process.env[envVar];
            if (value !== undefined) {
                environmentConfig[key] = value;
            }
        }
        return environmentConfig;
    };
    /**
     * Describe a Pinecone index
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const indexModel = await pc.describeIndex('my-index')
     * console.log(indexModel)
     * // {
     * //     name: 'sample-index-1',
     * //     dimension: 3,
     * //     metric: 'cosine',
     * //     host: 'sample-index-1-1390950.svc.apw5-4e34-81fa.pinecone.io',
     * //     spec: {
     * //           pod: undefined,
     * //           serverless: {
     * //               cloud: 'aws',
     * //               region: 'us-west-2'
     * //           }
     * //     },
     * //     status: {
     * //           ready: true,
     * //           state: 'Ready'
     * //     }
     * // }
     * ```
     *
     * @param indexName - The name of the index to describe.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves to {@link IndexModel}.
     */
    Pinecone.prototype.describeIndex = function (indexName) {
        return __awaiter(this, void 0, void 0, function () {
            var indexModel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._describeIndex(indexName)];
                    case 1:
                        indexModel = _a.sent();
                        // For any describeIndex calls we want to update the IndexHostSingleton cache.
                        // This prevents unneeded calls to describeIndex for resolving the host for vector operations.
                        if (indexModel.host) {
                            indexHostSingleton_1.IndexHostSingleton._set(this.config, indexName, indexModel.host);
                        }
                        return [2 /*return*/, Promise.resolve(indexModel)];
                }
            });
        });
    };
    /**
     * List all Pinecone indexes
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const indexList = await pc.listIndexes()
     * console.log(indexList)
     * // {
     * //     indexes: [
     * //       {
     * //         name: "sample-index-1",
     * //         dimension: 3,
     * //         metric: "cosine",
     * //         host: "sample-index-1-1234567.svc.apw5-2e18-32fa.pinecone.io",
     * //         spec: {
     * //           serverless: {
     * //             cloud: "aws",
     * //             region: "us-west-2"
     * //           }
     * //         },
     * //         status: {
     * //           ready: true,
     * //           state: "Ready"
     * //         }
     * //       },
     * //       {
     * //         name: "sample-index-2",
     * //         dimension: 3,
     * //         metric: "cosine",
     * //         host: "sample-index-2-1234567.svc.apw2-5e76-83fa.pinecone.io",
     * //         spec: {
     * //           serverless: {
     * //             cloud: "aws",
     * //             region: "us-west-2"
     * //           }
     * //         },
     * //         status: {
     * //           ready: true,
     * //           state: "Ready"
     * //         }
     * //       }
     * //     ]
     * //   }
     * ```
     *
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves to {@link IndexList}.
     */
    Pinecone.prototype.listIndexes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var indexList, i, index;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._listIndexes()];
                    case 1:
                        indexList = _a.sent();
                        // For any listIndexes calls we want to update the IndexHostSingleton cache.
                        // This prevents unneeded calls to describeIndex for resolving the host for index operations.
                        if (indexList.indexes && indexList.indexes.length > 0) {
                            for (i = 0; i < indexList.indexes.length; i++) {
                                index = indexList.indexes[i];
                                indexHostSingleton_1.IndexHostSingleton._set(this.config, index.name, index.host);
                            }
                        }
                        return [2 /*return*/, Promise.resolve(indexList)];
                }
            });
        });
    };
    /**
     * Creates a new index.
     *
     * @example
     * The minimum required configuration to create an index is the index `name`, `dimension`, and `spec`.
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     *
     * const pc = new Pinecone();
     *
     * await pc.createIndex({ name: 'my-index', dimension: 128, spec: { serverless: { cloud: 'aws', region: 'us-west-2' }}})
     * ```
     *
     * @example
     * The `spec` object defines how the index should be deployed. For serverless indexes, you define only the cloud and region where the index should be hosted.
     * For pod-based indexes, you define the environment where the index should be hosted, the pod type and size to use, and other index characteristics.
     * In a different example, you can create a pod-based index by specifying the `pod` spec object with the `environment`, `pods`, `podType`, and `metric` properties.
     * For more information on creating indexes, see [Understanding indexes](https://docs.pinecone.io/guides/indexes/understanding-indexes).
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.createIndex({
     *  name: 'my-index',
     *  dimension: 1536,
     *  metric: 'cosine',
     *  spec: {
     *    pod: {
     *      environment: 'us-west-2-gcp',
     *      pods: 1,
     *      podType: 'p1.x1'
     *    }
     *   }
     * })
     * ```
     *
     * @example
     * If you would like to create the index only if it does not already exist, you can use the `suppressConflicts` boolean option.
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.createIndex({
     *   name: 'my-index',
     *   dimension: 1536,
     *   spec: {
     *     serverless: {
     *       cloud: 'aws',
     *       region: 'us-west-2'
     *     }
     *   },
     *   suppressConflicts: true
     * })
     * ```
     *
     * @example
     * If you plan to begin upserting immediately after index creation is complete, you should use the `waitUntilReady` option. Otherwise, the index may not be ready to receive data operations when you attempt to upsert.
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.createIndex({
     *  name: 'my-index',
     *   spec: {
     *     serverless: {
     *       cloud: 'aws',
     *       region: 'us-west-2'
     *     }
     *   },
     *  waitUntilReady: true
     * });
     *
     * const records = [
     *   // PineconeRecord objects with your embedding values
     * ]
     * await pc.index('my-index').upsert(records)
     * ```
     *
     * @example
     * By default all metadata fields are indexed when records are upserted with metadata, but if you want to improve performance you can specify the specific fields you want to index. This example is showing a few hypothetical metadata fields, but the values you'd use depend on what metadata you plan to store with records in your Pinecone index.
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.createIndex({
     *   name: 'my-index',
     *   dimension: 1536,
     *   spec: {
     *     serverless: {
     *       cloud: 'aws',
     *       region: 'us-west-2',
     *       metadataConfig: { 'indexed' : ['productName', 'productDescription'] }
     *     }
     *   },
     * })
     * ```
     *
     * @param options - The index configuration.
     *
     * @see [Distance metrics](https://docs.pinecone.io/docs/indexes#distance-metrics)
     * @see [Pod types and sizes](https://docs.pinecone.io/docs/indexes#pods-pod-types-and-pod-sizes)
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeBadRequestError} when index creation fails due to invalid parameters being specified or other problem such as project quotas limiting the creation of any additional indexes.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @throws {@link Errors.PineconeConflictError} when attempting to create an index using a name that already exists in your project.
     * @returns A promise that resolves to {@link IndexModel} when the request to create the index is completed. Note that the index is not immediately ready to use. You can use the {@link describeIndex} function to check the status of the index.
     */
    Pinecone.prototype.createIndex = function (options) {
        return this._createIndex(options);
    };
    /**
     * Deletes an index
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.deleteIndex('my-index')
     * ```
     *
     * @param indexName - The name of the index to delete.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @returns A promise that resolves when the request to delete the index is completed.
     */
    Pinecone.prototype.deleteIndex = function (indexName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._deleteIndex(indexName)];
                    case 1:
                        _a.sent();
                        // When an index is deleted, we need to evict the host from the IndexHostSingleton cache.
                        indexHostSingleton_1.IndexHostSingleton._delete(this.config, indexName);
                        return [2 /*return*/, Promise.resolve()];
                }
            });
        });
    };
    /**
     * Configure an index
     *
     * Use this method to update configuration on an existing index. For both pod-based and serverless indexes you can update
     * the deletionProtection status of an index. For pod-based index you can also configure the number of replicas and pod type.
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.configureIndex('my-index', {
     *   deletionProtection: 'enabled',
     *   spec:{ pod:{ replicas: 2, podType: 'p1.x2' }},
     * });
     * ```
     *
     * @param indexName - The name of the index to configure.
     * @param options - The configuration properties you would like to update
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves to {@link IndexModel} when the request to configure the index is completed.
     */
    Pinecone.prototype.configureIndex = function (indexName, options) {
        return this._configureIndex(indexName, options);
    };
    /**
     * Create a new collection from an existing index
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const indexList = await pc.listIndexes()
     * const indexName = indexList.indexes[0].name;
     * await pc.createCollection({
     *  name: 'my-collection',
     *  source: indexName
     * })
     * ```
     *
     * @param options - The collection configuration.
     * @param options.name - The name of the collection. Must be unique within the project and contain alphanumeric and hyphen characters. The name must start and end with alphanumeric characters.
     * @param options.source - The name of the index to use as the source for the collection.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns a promise that resolves to {@link CollectionModel} when the request to create the collection is completed.
     */
    Pinecone.prototype.createCollection = function (options) {
        return this._createCollection(options);
    };
    /**
     * List all collections in a project
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.listCollections()
     * ```
     *
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves to {@link CollectionList}.
     */
    Pinecone.prototype.listCollections = function () {
        return this._listCollections();
    };
    /**
     * Delete a collection by collection name
     *
     * @example
     * ```
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * const collectionList = await pc.listCollections()
     * const collectionName = collectionList.collections[0].name;
     * await pc.deleteCollection(collectionName)
     * ```
     *
     * @param collectionName - The name of the collection to delete.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves when the request to delete the collection is completed.
     */
    Pinecone.prototype.deleteCollection = function (collectionName) {
        return this._deleteCollection(collectionName);
    };
    /**
     * Describe a collection
     *
     * @example
     * ```js
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone();
     *
     * await pc.describeCollection('my-collection')
     * ```
     *
     * @param collectionName - The name of the collection to describe.
     * @throws {@link Errors.PineconeArgumentError} when arguments passed to the method fail a runtime validation.
     * @throws {@link Errors.PineconeConnectionError} when network problems or an outage of Pinecone's APIs prevent the request from being completed.
     * @returns A promise that resolves to a {@link CollectionModel}.
     */
    Pinecone.prototype.describeCollection = function (collectionName) {
        return this._describeCollection(collectionName);
    };
    /** @internal */
    Pinecone.prototype._checkForBrowser = function () {
        if ((0, environment_1.isBrowser)()) {
            console.warn('The Pinecone SDK is intended for server-side use only. Using the SDK within a browser context can expose your API key(s). If you have deployed the SDK to production in a browser, please rotate your API keys.');
        }
    };
    /**
     * @returns The configuration object that was passed to the Pinecone constructor.
     */
    Pinecone.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * Targets a specific index for performing data operations.
     *
     * ```typescript
     * import { Pinecone } from '@pinecone-database/pinecone';
     * const pc = new Pinecone()
     *
     * const index = pc.index('index-name')
     * ```
     *
     * #### Targeting an index, with user-defined Metadata types
     *
     * If you are storing metadata alongside your vector values inside your Pinecone records, you can pass a type parameter to `index()` in order to get proper TypeScript typechecking when upserting and querying data.
     *
     * ```typescript
     * import { Pinecone } from '@pinecone-database/pinecone';
     *
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
     * @param indexName - The name of the index to target.
     * @param indexHostUrl - An optional host url to use for operations against this index. If not provided, the host url will be resolved by calling {@link describeIndex}.
     * @param additionalHeaders - An optional object containing additional headers to pass with each index request.
     * @typeParam T - The type of the metadata object associated with each record.
     * @returns An {@link Index} object that can be used to perform data operations.
     */
    Pinecone.prototype.index = function (indexName, indexHostUrl, additionalHeaders) {
        return new data_1.Index(indexName, this.config, undefined, indexHostUrl, additionalHeaders);
    };
    /**
     * {@inheritDoc index}
     */
    // Alias method to match the Python SDK capitalization
    Pinecone.prototype.Index = function (indexName, indexHostUrl, additionalHeaders) {
        return this.index(indexName, indexHostUrl, additionalHeaders);
    };
    return Pinecone;
}());
exports.Pinecone = Pinecone;
//# sourceMappingURL=pinecone.js.map