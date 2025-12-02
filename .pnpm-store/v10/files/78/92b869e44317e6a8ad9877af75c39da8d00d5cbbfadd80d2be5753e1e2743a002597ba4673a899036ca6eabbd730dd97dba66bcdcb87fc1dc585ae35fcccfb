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
var _AstraAdmin_defaultOpts, _AstraAdmin_httpClient;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstraAdmin = void 0;
const api_1 = require("../api");
const db_1 = require("../data-api/db");
const common_1 = require("../common");
const utils_1 = require("../devops/utils");
class AstraAdmin {
        constructor(rootOpts, adminOpts) {
        _AstraAdmin_defaultOpts.set(this, void 0);
        _AstraAdmin_httpClient.set(this, void 0);
        (0, utils_1.validateAdminOpts)(adminOpts);
        __classPrivateFieldSet(this, _AstraAdmin_defaultOpts, rootOpts, "f");
        const combinedAdminOpts = {
            ...rootOpts.adminOptions,
            ...adminOpts,
            adminToken: common_1.TokenProvider.parseToken(adminOpts?.adminToken ?? rootOpts.adminOptions.adminToken),
        };
        __classPrivateFieldSet(this, _AstraAdmin_httpClient, new api_1.DevOpsAPIHttpClient({
            baseUrl: combinedAdminOpts.endpointUrl || api_1.DEFAULT_DEVOPS_API_ENDPOINTS.prod,
            monitorCommands: combinedAdminOpts.monitorCommands,
            emitter: rootOpts.emitter,
            fetchCtx: rootOpts.fetchCtx,
            userAgent: rootOpts.userAgent,
            tokenProvider: combinedAdminOpts.adminToken,
        }), "f");
    }
    db(endpointOrId, regionOrOptions, maybeOptions) {
        return (0, db_1.mkDb)(__classPrivateFieldGet(this, _AstraAdmin_defaultOpts, "f"), endpointOrId, regionOrOptions, maybeOptions);
    }
    dbAdmin(endpointOrId, regionOrOptions, maybeOptions) {
                return this.db(endpointOrId, regionOrOptions, maybeOptions).admin(__classPrivateFieldGet(this, _AstraAdmin_defaultOpts, "f").adminOptions);
    }
        async dbInfo(id, options) {
        const resp = await __classPrivateFieldGet(this, _AstraAdmin_httpClient, "f").request({
            method: api_1.HttpMethods.Get,
            path: `/databases/${id}`,
        }, options);
        return resp.data;
    }
        async listDatabases(options) {
        const params = {};
        if (typeof options?.include === 'string') {
            (params['include'] = options.include);
        }
        if (typeof options?.provider === 'string') {
            (params['provider'] = options.provider);
        }
        if (typeof options?.limit === 'number') {
            (params['limit'] = String(options.skip));
        }
        if (typeof options?.skip === 'number') {
            (params['starting_after'] = String(options.skip));
        }
        const resp = await __classPrivateFieldGet(this, _AstraAdmin_httpClient, "f").request({
            method: api_1.HttpMethods.Get,
            path: `/databases`,
            params: params,
        }, options);
        return resp.data;
    }
        async createDatabase(config, options) {
        const definition = {
            capacityUnits: 1,
            tier: 'serverless',
            dbType: 'vector',
            keyspace: (0, common_1.resolveKeyspace)(config) || api_1.DEFAULT_KEYSPACE,
            ...config,
        };
        const resp = await __classPrivateFieldGet(this, _AstraAdmin_httpClient, "f").requestLongRunning({
            method: api_1.HttpMethods.Post,
            path: '/databases',
            data: definition,
        }, {
            id: (resp) => resp.headers.location,
            target: 'ACTIVE',
            legalStates: ['INITIALIZING', 'PENDING'],
            defaultPollInterval: 10000,
            options,
        });
        const db = (0, db_1.mkDb)(__classPrivateFieldGet(this, _AstraAdmin_defaultOpts, "f"), resp.headers.location, definition.region, { ...options?.dbOptions, keyspace: definition.keyspace });
        return db.admin(__classPrivateFieldGet(this, _AstraAdmin_defaultOpts, "f").adminOptions);
    }
        async dropDatabase(db, options) {
        const id = typeof db === 'string' ? db : db.id;
        await __classPrivateFieldGet(this, _AstraAdmin_httpClient, "f").requestLongRunning({
            method: api_1.HttpMethods.Post,
            path: `/databases/${id}/terminate`,
        }, {
            id: id,
            target: 'TERMINATED',
            legalStates: ['TERMINATING'],
            defaultPollInterval: 10000,
            options,
        });
    }
    get _httpClient() {
        return __classPrivateFieldGet(this, _AstraAdmin_httpClient, "f");
    }
}
exports.AstraAdmin = AstraAdmin;
_AstraAdmin_defaultOpts = new WeakMap(), _AstraAdmin_httpClient = new WeakMap();
