"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
exports.hrTimeMs = hrTimeMs;
exports.buildUserAgent = buildUserAgent;
const constants_1 = require("../../api/constants");
class HttpClient {
    constructor(options, headerProviders) {
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "emitter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "monitorCommands", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fetchCtx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseHeaders", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "headerProviders", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.baseUrl = options.baseUrl;
        this.emitter = options.emitter;
        this.monitorCommands = options.monitorCommands;
        this.fetchCtx = options.fetchCtx;
        if (options.baseApiPath) {
            this.baseUrl += '/' + options.baseApiPath;
        }
        this.baseHeaders = {};
        this.baseHeaders['User-Agent'] = options.userAgent;
        this.baseHeaders['Content-Type'] = 'application/json';
        this.headerProviders = headerProviders;
    }
    async _request(info) {
        if (this.fetchCtx.closed.ref) {
            throw new Error('Can\'t make requests on a closed client');
        }
        const msRemaining = info.timeoutManager.msRemaining();
        if (msRemaining <= 0) {
            throw info.timeoutManager.mkTimeoutError(info);
        }
        const params = info.params ?? {};
        const url = (Object.keys(params).length > 0)
            ? `${info.url}?${new URLSearchParams(params).toString()}`
            : info.url;
        const reqHeaders = { ...this.baseHeaders };
        for (const provider of this.headerProviders) {
            const maybePromise = provider();
            const newHeaders = ('then' in maybePromise)
                ? await maybePromise
                : maybePromise;
            Object.assign(reqHeaders, newHeaders);
        }
        return await this.fetchCtx.ctx.fetch({
            url: url,
            body: info.data,
            method: info.method,
            headers: reqHeaders,
            forceHttp1: info.forceHttp1,
            timeout: msRemaining,
            mkTimeoutError: () => info.timeoutManager.mkTimeoutError(info),
        });
    }
}
exports.HttpClient = HttpClient;
function hrTimeMs() {
    const hrtime = process.hrtime();
    return Math.floor(hrtime[0] * 1000 + hrtime[1] / 1000000);
}
function buildUserAgent(caller) {
    const callers = ((!caller)
        ? [] :
        Array.isArray(caller[0])
            ? caller
            : [caller]);
    const callerString = callers.map((c) => {
        return c[1] ? `${c[0]}/${c[1]}` : c[0];
    }).join(' ');
    return `${constants_1.RAGSTACK_REQUESTED_WITH} ${callerString} ${constants_1.CLIENT_USER_AGENT}`.trim();
}
