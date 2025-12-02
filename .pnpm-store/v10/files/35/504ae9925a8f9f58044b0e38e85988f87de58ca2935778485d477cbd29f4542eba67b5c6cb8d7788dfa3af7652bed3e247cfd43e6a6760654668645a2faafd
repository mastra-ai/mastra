"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Db_defaultOpts, _Db_token, _Db_httpClient, _Db_endpoint;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Db = void 0;
exports.mkDb = mkDb;
exports.validateDbOpts = validateDbOpts;
const data_api_1 = require("../data-api");
const api_1 = require("../api");
const astra_db_admin_1 = require("../devops/astra-db-admin");
const utils_1 = require("../data-api/utils");
const common_1 = require("../common");
const data_api_db_admin_1 = require("../devops/data-api-db-admin");
class Db {
        constructor(endpoint, rootOpts, dbOpts) {
        _Db_defaultOpts.set(this, void 0);
        _Db_token.set(this, void 0);
        _Db_httpClient.set(this, void 0);
        _Db_endpoint.set(this, void 0);
        Object.defineProperty(this, "_keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        __classPrivateFieldSet(this, _Db_defaultOpts, rootOpts, "f");
        __classPrivateFieldSet(this, _Db_token, common_1.TokenProvider.parseToken(dbOpts?.token ?? rootOpts.dbOptions.token), "f");
        const combinedDbOpts = {
            ...rootOpts.dbOptions,
            ...dbOpts,
        };
        this._keyspace = {
            ref: (rootOpts.environment === 'astra')
                ? (0, common_1.resolveKeyspace)(combinedDbOpts) ?? api_1.DEFAULT_KEYSPACE
                : (0, common_1.resolveKeyspace)(combinedDbOpts),
        };
        __classPrivateFieldSet(this, _Db_httpClient, new api_1.DataAPIHttpClient({
            baseUrl: endpoint,
            tokenProvider: __classPrivateFieldGet(this, _Db_token, "f"),
            embeddingHeaders: data_api_1.EmbeddingHeadersProvider.parseHeaders(null),
            baseApiPath: combinedDbOpts.dataApiPath || api_1.DEFAULT_DATA_API_PATHS[rootOpts.environment],
            emitter: rootOpts.emitter,
            monitorCommands: combinedDbOpts.monitorCommands,
            fetchCtx: rootOpts.fetchCtx,
            keyspace: this._keyspace,
            userAgent: rootOpts.userAgent,
            emissionStrategy: api_1.EmissionStrategy.Normal,
        }), "f");
        this._id = (0, utils_1.extractDbIdFromUrl)(endpoint);
        __classPrivateFieldSet(this, _Db_endpoint, endpoint, "f");
    }
        get keyspace() {
        if (!this._keyspace.ref) {
            throw new Error('No keyspace set for DB (can\'t do db.keyspace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
        }
        return this._keyspace.ref;
    }
        get namespace() {
        if (!this._keyspace.ref) {
            throw new Error('No keyspace set for DB (can\'t do db.namespace, or perform any operation requiring it). Use `db.useKeyspace`, or pass the keyspace as an option parameter explicitly.');
        }
        return this._keyspace.ref;
    }
        get id() {
        if (!this._id) {
            throw new Error('Non-Astra databases do not have an appropriate ID');
        }
        return this._id;
    }
        useKeyspace(keyspace) {
        this._keyspace.ref = keyspace;
    }
        useNamespace(keyspace) {
        this._keyspace.ref = keyspace;
    }
    admin(options) {
        const environment = options?.environment ?? 'astra';
        (0, common_1.validateDataAPIEnv)(environment);
        if (__classPrivateFieldGet(this, _Db_defaultOpts, "f").environment !== environment) {
            throw new Error('Mismatching environment—environment option is not the same as set in the DataAPIClient');
        }
        if (environment === 'astra') {
            return new astra_db_admin_1.AstraDbAdmin(this, __classPrivateFieldGet(this, _Db_defaultOpts, "f"), options, __classPrivateFieldGet(this, _Db_token, "f"), __classPrivateFieldGet(this, _Db_endpoint, "f"));
        }
        return new data_api_db_admin_1.DataAPIDbAdmin(this, __classPrivateFieldGet(this, _Db_httpClient, "f"), options);
    }
        async info(options) {
        return await this.admin().info(options).then(i => i.info);
    }
        collection(name, options) {
        return new data_api_1.Collection(this, __classPrivateFieldGet(this, _Db_httpClient, "f"), name, options);
    }
        async collections(options) {
        const collections = await this.listCollections({
            keyspace: (0, common_1.resolveKeyspace)(options),
            maxTimeMS: options?.maxTimeMS,
            nameOnly: true,
        });
        return collections.map(c => this.collection(c, options));
    }
        async createCollection(collectionName, options) {
        const command = {
            createCollection: {
                name: collectionName,
                options: {
                    defaultId: options?.defaultId,
                    indexing: options?.indexing,
                    vector: options?.vector,
                },
            },
        };
        const timeoutManager = __classPrivateFieldGet(this, _Db_httpClient, "f").timeoutManager(options?.maxTimeMS);
        const keyspace = (0, common_1.resolveKeyspace)(options) ?? this.keyspace;
        if (options?.checkExists !== false) {
            const collections = await this.listCollections({ keyspace: keyspace, maxTimeMS: timeoutManager.msRemaining() });
            if (collections.some(c => c.name === collectionName)) {
                throw new data_api_1.CollectionAlreadyExistsError((0, common_1.resolveKeyspace)(options) ?? this.keyspace, collectionName);
            }
        }
        await __classPrivateFieldGet(this, _Db_httpClient, "f").executeCommand(command, { keyspace: keyspace, timeoutManager });
        return this.collection(collectionName, options);
    }
        async dropCollection(name, options) {
        const command = {
            deleteCollection: { name },
        };
        const resp = await __classPrivateFieldGet(this, _Db_httpClient, "f").executeCommand(command, options);
        return resp.status?.ok === 1;
    }
    async listCollections(options) {
        const command = {
            findCollections: {
                options: {
                                        explain: options?.nameOnly !== true,
                },
            },
        };
        const resp = await __classPrivateFieldGet(this, _Db_httpClient, "f").executeCommand(command, options);
        return resp.status.collections;
    }
        async command(command, options) {
        return await __classPrivateFieldGet(this, _Db_httpClient, "f").executeCommand(command, options);
    }
    get _httpClient() {
        return __classPrivateFieldGet(this, _Db_httpClient, "f");
    }
}
exports.Db = Db;
_Db_defaultOpts = new WeakMap(), _Db_token = new WeakMap(), _Db_httpClient = new WeakMap(), _Db_endpoint = new WeakMap();
function mkDb(rootOpts, endpointOrId, regionOrOptions, maybeOptions) {
    const dbOpts = (typeof regionOrOptions === 'string')
        ? maybeOptions
        : regionOrOptions;
    validateDbOpts(dbOpts);
    if (typeof regionOrOptions === 'string' && (endpointOrId.startsWith('https://') || endpointOrId.startsWith('http://'))) {
        throw new Error('Unexpected db() argument: database id can\'t start with "http(s)://". Did you mean to call `.db(endpoint, { keyspace })`?');
    }
    const endpoint = (typeof regionOrOptions === 'string')
        ? 'https://' + endpointOrId + '-' + regionOrOptions + '.apps.astra.datastax.com'
        : endpointOrId;
    return new Db(endpoint, rootOpts, dbOpts);
}
function validateDbOpts(opts) {
    (0, utils_1.validateOption)('dbOptions', opts, 'object');
    if (!opts) {
        return;
    }
    for (const prop of ['keyspace', 'namespace']) {
        (0, utils_1.validateOption)(`dbOptions.${prop}`, opts[prop], 'string', false, (keyspace) => {
            if (!keyspace.match(/^\w{1,48}$/)) {
                throw new Error(`Invalid ${prop} option; expected a string of 1-48 alphanumeric characters`);
            }
        });
    }
    (0, utils_1.validateOption)('dbOptions.monitorCommands', opts.monitorCommands, 'boolean');
    (0, utils_1.validateOption)('dbOptions.dataApiPath', opts.dataApiPath, 'string');
}
