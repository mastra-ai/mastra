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
var _DataAPIHttpClient_props;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAPIHttpClient = exports.EmissionStrategy = void 0;
exports.replacer = replacer;
exports.reviver = reviver;
const api_1 = require("../../api");
const data_api_1 = require("../../data-api");
const timeout_managers_1 = require("../../api/timeout-managers");
const events_1 = require("../../data-api/events");
const errors_1 = require("../../data-api/errors");
const devops_1 = require("../../devops");
const common_1 = require("../../common");
const embedding_providers_1 = require("../../data-api/embedding-providers");
exports.EmissionStrategy = {
    Normal: (emitter) => ({
        emitCommandStarted(info) {
            emitter.emit('commandStarted', new events_1.CommandStartedEvent(info));
        },
        emitCommandFailed(info, error, started) {
            emitter.emit('commandFailed', new events_1.CommandFailedEvent(info, error, started));
        },
        emitCommandSucceeded(info, resp, warnings, started) {
            emitter.emit('commandSucceeded', new events_1.CommandSucceededEvent(info, resp, warnings, started));
        },
    }),
    Admin: (emitter) => ({
        emitCommandStarted(info) {
            emitter.emit('adminCommandStarted', new devops_1.AdminCommandStartedEvent(adaptInfo4Devops(info), true, info.timeoutManager.msRemaining()));
        },
        emitCommandFailed(info, error, started) {
            emitter.emit('adminCommandFailed', new devops_1.AdminCommandFailedEvent(adaptInfo4Devops(info), true, error, started));
        },
        emitCommandSucceeded(info, resp, warnings, started) {
            emitter.emit('adminCommandSucceeded', new devops_1.AdminCommandSucceededEvent(adaptInfo4Devops(info), true, resp, warnings, started));
        },
    }),
};
const adaptInfo4Devops = (info) => ({
    method: 'POST',
    data: info.command,
    path: info.url,
    params: {},
});
class DataAPIHttpClient extends api_1.HttpClient {
    constructor(props) {
        super(props, [mkAuthHeaderProvider(props.tokenProvider), props.embeddingHeaders.getHeaders.bind(props.embeddingHeaders)]);
        Object.defineProperty(this, "collection", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "keyspace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxTimeMS", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "emissionStrategy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _DataAPIHttpClient_props.set(this, void 0);
        this.keyspace = props.keyspace;
        __classPrivateFieldSet(this, _DataAPIHttpClient_props, props, "f");
        this.maxTimeMS = this.fetchCtx.maxTimeMS ?? api_1.DEFAULT_TIMEOUT;
        this.emissionStrategy = props.emissionStrategy(props.emitter);
    }
    forCollection(keyspace, collection, opts) {
        const clone = new DataAPIHttpClient({
            ...__classPrivateFieldGet(this, _DataAPIHttpClient_props, "f"),
            embeddingHeaders: embedding_providers_1.EmbeddingHeadersProvider.parseHeaders(opts?.embeddingApiKey),
            keyspace: { ref: keyspace },
        });
        clone.collection = collection;
        clone.maxTimeMS = opts?.defaultMaxTimeMS ?? this.maxTimeMS;
        return clone;
    }
    forDbAdmin(opts) {
        const clone = new DataAPIHttpClient({
            ...__classPrivateFieldGet(this, _DataAPIHttpClient_props, "f"),
            tokenProvider: opts?.adminToken ? common_1.TokenProvider.parseToken(opts?.adminToken) : __classPrivateFieldGet(this, _DataAPIHttpClient_props, "f").tokenProvider,
            monitorCommands: opts?.monitorCommands || __classPrivateFieldGet(this, _DataAPIHttpClient_props, "f").monitorCommands,
            baseUrl: opts?.endpointUrl || __classPrivateFieldGet(this, _DataAPIHttpClient_props, "f").baseUrl,
            baseApiPath: opts?.endpointUrl ? '' : __classPrivateFieldGet(this, _DataAPIHttpClient_props, "f").baseApiPath,
        });
        clone.emissionStrategy = exports.EmissionStrategy.Admin(this.emitter);
        clone.collection = undefined;
        return clone;
    }
    timeoutManager(timeout) {
        timeout ?? (timeout = this.maxTimeMS);
        return new timeout_managers_1.TimeoutManager(timeout, () => new data_api_1.DataAPITimeoutError(timeout));
    }
    async executeCommand(command, options) {
        const timeoutManager = options?.timeoutManager ?? this.timeoutManager(options?.maxTimeMS);
        return await this._requestDataAPI({
            url: this.baseUrl,
            timeoutManager: timeoutManager,
            collection: options?.collection,
            keyspace: (0, common_1.resolveKeyspace)(options, true),
            command: command,
        });
    }
    async _requestDataAPI(info) {
        let started = 0;
        try {
            info.collection || (info.collection = this.collection);
            if (info.keyspace !== null) {
                info.keyspace || (info.keyspace = this.keyspace?.ref);
                if ((0, common_1.isNullish)(info.keyspace)) {
                    throw new Error('Db is missing a required keyspace; be sure to set one w/ client.db(..., { keyspace }), or db.useKeyspace()');
                }
            }
            const keyspacePath = info.keyspace ? `/${info.keyspace}` : '';
            const collectionPath = info.collection ? `/${info.collection}` : '';
            info.url += keyspacePath + collectionPath;
            if (this.monitorCommands) {
                started = (0, api_1.hrTimeMs)();
                this.emissionStrategy.emitCommandStarted(info);
            }
            const resp = await this._request({
                url: info.url,
                data: JSON.stringify(info.command, replacer),
                timeoutManager: info.timeoutManager,
                method: api_1.HttpMethods.Post,
            });
            if (resp.status >= 400 && resp.status !== 401) {
                throw new errors_1.DataAPIHttpError(resp);
            }
            const data = resp.body ? JSON.parse(resp.body, reviver) : {};
            const warnings = data?.status?.warnings ?? [];
            delete data?.status?.warnings;
            if (data.errors && data.errors.length > 0 && data.errors[0]?.errorCode === 'COLLECTION_NOT_EXIST') {
                const name = data.errors[0]?.message.split(': ')[1];
                throw new errors_1.CollectionNotFoundError(info.keyspace ?? '<unknown>', name);
            }
            if (data.errors && data.errors.length > 0) {
                throw (0, errors_1.mkRespErrorFromResponse)(data_api_1.DataAPIResponseError, info.command, data, warnings);
            }
            const respData = {
                data: data.data,
                status: data.status,
                errors: data.errors,
            };
            if (this.monitorCommands) {
                this.emissionStrategy.emitCommandSucceeded(info, respData, warnings, started);
            }
            return respData;
        }
        catch (e) {
            if (this.monitorCommands) {
                this.emissionStrategy.emitCommandFailed(info, e, started);
            }
            throw e;
        }
    }
}
exports.DataAPIHttpClient = DataAPIHttpClient;
_DataAPIHttpClient_props = new WeakMap();
function replacer(key, value) {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (typeof this[key] === 'object') {
        if (key === '$date') {
            return new Date(value).valueOf();
        }
        if (this[key] instanceof Date) {
            return { $date: this[key].valueOf() };
        }
    }
    return value;
}
function reviver(_, value) {
    if (!value) {
        return value;
    }
    if (value.$date) {
        return new Date(value.$date);
    }
    if (value.$objectId) {
        return new data_api_1.ObjectId(value.$objectId);
    }
    if (value.$uuid) {
        return new data_api_1.UUID(value.$uuid);
    }
    return value;
}
const mkAuthHeaderProvider = (tp) => () => {
    const token = tp.getToken();
    return (token instanceof Promise)
        ? token.then(mkAuthHeader)
        : mkAuthHeader(token);
};
const mkAuthHeader = (token) => (token)
    ? { [api_1.DEFAULT_DATA_API_AUTH_HEADER]: token }
    : {};
