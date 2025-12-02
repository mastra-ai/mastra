"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection JSDeprecatedSymbols
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
var _DataAPIClient_options, _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAPIClient = exports.DataAPIClientEventEmitterBase = void 0;
const db_1 = require("../data-api/db");
const astra_admin_1 = require("../devops/astra-admin");
const utils_1 = require("../data-api/utils");
const api_1 = require("../api");
const fetch_native_1 = require("../api/fetch/fetch-native");
const version_1 = require("../version");
const common_1 = require("../common");
const utils_2 = require("../devops/utils");
exports.DataAPIClientEventEmitterBase = (() => {
    try {
        return require('events').EventEmitter;
    }
    catch (_) {
        throw new Error(`\`${version_1.LIB_NAME}\` requires the \`events\` module to be available for usage. Please provide a polyfill (e.g. the \`events\` package) or use a compatible environment.`);
    }
})();
class DataAPIClient extends exports.DataAPIClientEventEmitterBase {
    constructor(tokenOrOptions, maybeOptions) {
        super();
        _DataAPIClient_options.set(this, void 0);
                Object.defineProperty(this, _a, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const tokenPassed = (typeof tokenOrOptions === 'string' || tokenOrOptions instanceof common_1.TokenProvider || arguments.length > 1);
        const token = (tokenPassed)
            ? tokenOrOptions
            : undefined;
        const options = (tokenPassed)
            ? maybeOptions
            : tokenOrOptions;
        validateRootOpts(options);
        __classPrivateFieldSet(this, _DataAPIClient_options, {
            environment: options?.environment ?? 'astra',
            fetchCtx: buildFetchCtx(options || undefined),
            dbOptions: {
                monitorCommands: false,
                ...options?.dbOptions,
                token: common_1.TokenProvider.parseToken(options?.dbOptions?.token ?? token),
            },
            adminOptions: {
                monitorCommands: false,
                ...options?.adminOptions,
                adminToken: common_1.TokenProvider.parseToken(options?.dbOptions?.token ?? token),
            },
            emitter: this,
            userAgent: (0, api_1.buildUserAgent)(options?.caller),
        }, "f");
        if (Symbol.asyncDispose) {
            this[Symbol.asyncDispose] = () => this.close();
        }
    }
    db(endpointOrId, regionOrOptions, maybeOptions) {
        return (0, db_1.mkDb)(__classPrivateFieldGet(this, _DataAPIClient_options, "f"), endpointOrId, regionOrOptions, maybeOptions);
    }
        admin(options) {
        return new astra_admin_1.AstraAdmin(__classPrivateFieldGet(this, _DataAPIClient_options, "f"), options);
    }
        async close() {
        await __classPrivateFieldGet(this, _DataAPIClient_options, "f").fetchCtx.ctx.close?.();
        __classPrivateFieldGet(this, _DataAPIClient_options, "f").fetchCtx.closed.ref = true;
    }
}
exports.DataAPIClient = DataAPIClient;
_DataAPIClient_options = new WeakMap(), _a = Symbol.asyncDispose;
function buildFetchCtx(options) {
    const clientType = (options?.httpOptions || getDeprecatedPrefersHttp2(options))
        ? options?.httpOptions?.client ?? 'default'
        : undefined;
    const ctx = (clientType === 'fetch')
        ? new fetch_native_1.FetchNative() :
        (clientType === 'custom')
            ? options.httpOptions.fetcher
            : tryLoadFetchH2(clientType, options);
    return {
        ctx: ctx,
        closed: { ref: false },
        maxTimeMS: options?.httpOptions?.maxTimeMS,
    };
}
function tryLoadFetchH2(clientType, options) {
    try {
        const httpOptions = options?.httpOptions;
        const preferHttp2 = httpOptions?.preferHttp2
            ?? getDeprecatedPrefersHttp2(options)
            ?? true;
        return new api_1.FetchH2(httpOptions, preferHttp2);
    }
    catch (e) {
        if ((0, common_1.isNullish)(clientType)) {
            return new fetch_native_1.FetchNative();
        }
        else {
            throw e;
        }
    }
}
// Shuts the linter up about 'preferHttp2' being deprecated
function getDeprecatedPrefersHttp2(opts) {
    return opts?.['preferHttp2'];
}
function validateRootOpts(opts) {
    (0, utils_1.validateOption)('DataAPIClientOptions', opts, 'object');
    if (!opts) {
        return;
    }
    (0, utils_1.validateOption)('caller', opts.caller, 'object', false, validateCaller);
    (0, utils_1.validateOption)('preferHttp2 option', getDeprecatedPrefersHttp2(opts), 'boolean');
    (0, db_1.validateDbOpts)(opts.dbOptions);
    (0, utils_2.validateAdminOpts)(opts.adminOptions);
    validateHttpOpts(opts.httpOptions);
    (0, common_1.validateDataAPIEnv)(opts.environment);
}
function validateHttpOpts(opts) {
    (0, utils_1.validateOption)('httpOptions', opts, 'object');
    if (!opts) {
        return;
    }
    (0, utils_1.validateOption)('httpOptions.client', opts.client, 'string', false, (client) => {
        if (!['fetch', 'default', 'custom'].includes(client)) {
            throw new Error('Invalid httpOptions.client; expected \'fetch\', \'default\', \'custom\', or undefined');
        }
    });
    (0, utils_1.validateOption)('httpOptions.maxTimeMS', opts.maxTimeMS, 'number');
    if (opts.client === 'default' || !opts.client) {
        (0, utils_1.validateOption)('httpOptions.preferHttp2', opts.preferHttp2, 'boolean');
        (0, utils_1.validateOption)('httpOptions.http1 options', opts.http1, 'object', false, (http1) => {
            (0, utils_1.validateOption)('http1.keepAlive', http1.keepAlive, 'boolean');
            (0, utils_1.validateOption)('http1.keepAliveMS', http1.keepAliveMS, 'number');
            (0, utils_1.validateOption)('http1.maxSockets', http1.maxSockets, 'number');
            (0, utils_1.validateOption)('http1.maxFreeSockets', http1.maxFreeSockets, 'number');
        });
    }
    if (opts.client === 'custom') {
        (0, utils_1.validateOption)('httpOptions.fetcher option', opts.fetcher, 'object', true, (fetcher) => {
            (0, utils_1.validateOption)('fetcher.fetch option', fetcher.fetch, 'function', true);
            (0, utils_1.validateOption)('fetcher.close option', fetcher.close, 'function');
        });
    }
}
function validateCaller(caller) {
    if (!Array.isArray(caller)) {
        throw new TypeError('Invalid caller; expected an array, or undefined/null');
    }
    const isCallerArr = Array.isArray(caller[0]);
    const callers = ((isCallerArr)
        ? caller
        : [caller]);
    callers.forEach((c, i) => {
        const idxMessage = (isCallerArr)
            ? ` at index ${i}`
            : '';
        if (!Array.isArray(c)) {
            throw new TypeError(`Invalid caller; expected [name, version?], or an array of such${idxMessage}`);
        }
        if (c.length < 1 || 2 < c.length) {
            throw new Error(`Invalid caller; expected [name, version?], or an array of such${idxMessage}`);
        }
        if (typeof c[0] !== 'string') {
            throw new Error(`Invalid caller; expected a string name${idxMessage}`);
        }
        if (c.length === 2 && typeof c[1] !== 'string') {
            throw new Error(`Invalid caller; expected a string version${idxMessage}`);
        }
    });
}
