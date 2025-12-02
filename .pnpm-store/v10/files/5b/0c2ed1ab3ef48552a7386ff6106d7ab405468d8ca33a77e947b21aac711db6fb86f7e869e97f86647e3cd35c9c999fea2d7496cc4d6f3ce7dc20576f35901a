"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection ExceptionCaughtLocallyJS
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchH2 = void 0;
const errors_1 = require("../../client/errors");
class FetchH2 {
    constructor(options, preferHttp2) {
        Object.defineProperty(this, "_http1", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_preferred", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_timeoutErrorCls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        try {
                        const [indirectRequire] = [require].map(x => isNaN(Math.random()) ? null : x);
            const fetchH2 = validateFetchH2(options?.fetchH2) ?? indirectRequire('fetch-h2');
            this._http1 = fetchH2.context({
                http1: {
                    keepAlive: options?.http1?.keepAlive,
                    keepAliveMsecs: options?.http1?.keepAliveMS,
                    maxSockets: options?.http1?.maxSockets,
                    maxFreeSockets: options?.http1?.maxFreeSockets,
                },
                httpsProtocols: ['http1'],
            });
            this._preferred = (preferHttp2)
                ? fetchH2.context()
                : this._http1;
            this._timeoutErrorCls = fetchH2.TimeoutError;
        }
        catch (e) {
            throw new errors_1.FailedToLoadDefaultClientError(e);
        }
    }
        async fetch(info) {
        const init = info;
        try {
            const resp = (info.forceHttp1)
                ? await this._http1.fetch(info.url, init)
                : await this._preferred.fetch(info.url, init);
            return {
                headers: Object.fromEntries(resp.headers.entries()),
                body: await resp.text(),
                status: resp.status,
                url: resp.url,
                httpVersion: resp.httpVersion,
                statusText: resp.statusText,
            };
        }
        catch (e) {
            if (e instanceof this._timeoutErrorCls) {
                throw info.mkTimeoutError();
            }
            throw e;
        }
    }
        async close() {
        await this._preferred.disconnectAll();
        await this._http1.disconnectAll();
    }
}
exports.FetchH2 = FetchH2;
function validateFetchH2(fetchH2) {
    if (fetchH2 === null || fetchH2 === undefined) {
        return fetchH2;
    }
    if (typeof fetchH2 !== 'object') {
        throw new TypeError('fetchH2 must be an object—did you pass in the module correctly?');
    }
    for (const prop of ['context', 'TimeoutError']) {
        if (!(prop in fetchH2)) {
            throw new TypeError(`fetchH2 missing the required '${prop}' property`);
        }
    }
    return fetchH2;
}
