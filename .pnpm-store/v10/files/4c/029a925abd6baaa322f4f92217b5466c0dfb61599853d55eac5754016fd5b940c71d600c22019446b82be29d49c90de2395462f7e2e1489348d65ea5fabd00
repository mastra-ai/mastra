"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection ExceptionCaughtLocallyJS
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
var _AstraDbAdmin_httpClient, _AstraDbAdmin_db;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstraDbAdmin = void 0;
const api_1 = require("../api");
const db_admin_1 = require("../devops/db-admin");
const common_1 = require("../common");
const utils_1 = require("../devops/utils");
class AstraDbAdmin extends db_admin_1.DbAdmin {
        constructor(db, rootOpts, adminOpts, dbToken, endpoint) {
        super();
        _AstraDbAdmin_httpClient.set(this, void 0);
        _AstraDbAdmin_db.set(this, void 0);
        (0, utils_1.validateAdminOpts)(adminOpts);
        const combinedAdminOpts = {
            ...rootOpts.adminOptions,
            ...adminOpts,
        };
        const _adminToken = common_1.TokenProvider.parseToken(adminOpts?.adminToken ?? rootOpts.adminOptions.adminToken);
        const adminToken = (_adminToken instanceof common_1.StaticTokenProvider && (0, common_1.isNullish)(_adminToken.getToken()))
            ? dbToken
            : _adminToken;
        const environment = (0, utils_1.extractAstraEnvironment)(endpoint);
        __classPrivateFieldSet(this, _AstraDbAdmin_httpClient, new api_1.DevOpsAPIHttpClient({
            baseUrl: combinedAdminOpts.endpointUrl ?? api_1.DEFAULT_DEVOPS_API_ENDPOINTS[environment],
            monitorCommands: combinedAdminOpts.monitorCommands,
            fetchCtx: rootOpts.fetchCtx,
            emitter: rootOpts.emitter,
            userAgent: rootOpts.userAgent,
            tokenProvider: adminToken,
        }), "f");
        __classPrivateFieldSet(this, _AstraDbAdmin_db, db, "f");
    }
        get id() {
        return __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id;
    }
        db() {
        return __classPrivateFieldGet(this, _AstraDbAdmin_db, "f");
    }
        async findEmbeddingProviders(options) {
        const resp = await __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").command({ findEmbeddingProviders: {} }, { keyspace: null, maxTimeMS: options?.maxTimeMS });
        return resp.status;
    }
        async info(options) {
        const resp = await __classPrivateFieldGet(this, _AstraDbAdmin_httpClient, "f").request({
            method: api_1.HttpMethods.Get,
            path: `/databases/${__classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id}`,
        }, options);
        return resp.data;
    }
        async listKeyspaces(options) {
        return this.info(options).then(i => [i.info.keyspace, ...i.info.additionalKeyspaces ?? []].filter(Boolean));
    }
        async listNamespaces(options) {
        return this.listKeyspaces(options);
    }
        async createKeyspace(keyspace, options) {
        if (options?.updateDbKeyspace) {
            __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").useKeyspace(keyspace);
        }
        await __classPrivateFieldGet(this, _AstraDbAdmin_httpClient, "f").requestLongRunning({
            method: api_1.HttpMethods.Post,
            path: `/databases/${__classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id}/keyspaces/${keyspace}`,
        }, {
            id: __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id,
            target: 'ACTIVE',
            legalStates: ['MAINTENANCE'],
            defaultPollInterval: 1000,
            options,
        });
    }
        async createNamespace(keyspace, options) {
        return this.createKeyspace(keyspace, { ...options, updateDbKeyspace: options?.updateDbNamespace });
    }
        async dropKeyspace(keyspace, options) {
        await __classPrivateFieldGet(this, _AstraDbAdmin_httpClient, "f").requestLongRunning({
            method: api_1.HttpMethods.Delete,
            path: `/databases/${__classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id}/keyspaces/${keyspace}`,
        }, {
            id: __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id,
            target: 'ACTIVE',
            legalStates: ['MAINTENANCE'],
            defaultPollInterval: 1000,
            options,
        });
    }
        async dropNamespace(keyspace, options) {
        return this.dropKeyspace(keyspace, options);
    }
        async drop(options) {
        await __classPrivateFieldGet(this, _AstraDbAdmin_httpClient, "f").requestLongRunning({
            method: api_1.HttpMethods.Post,
            path: `/databases/${__classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id}/terminate`,
        }, {
            id: __classPrivateFieldGet(this, _AstraDbAdmin_db, "f").id,
            target: 'TERMINATED',
            legalStates: ['TERMINATING'],
            defaultPollInterval: 10000,
            options,
        });
    }
    get _httpClient() {
        return __classPrivateFieldGet(this, _AstraDbAdmin_httpClient, "f");
    }
}
exports.AstraDbAdmin = AstraDbAdmin;
_AstraDbAdmin_httpClient = new WeakMap(), _AstraDbAdmin_db = new WeakMap();
