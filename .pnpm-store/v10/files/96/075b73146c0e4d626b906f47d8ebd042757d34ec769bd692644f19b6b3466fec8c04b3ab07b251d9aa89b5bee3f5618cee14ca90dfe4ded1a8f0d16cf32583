"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
// noinspection ExceptionCaughtLocallyJS
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchNative = void 0;
class FetchNative {
        async fetch(info) {
        try {
            const init = info;
            init.keepalive = true;
            init.signal = AbortSignal.timeout(info.timeout);
            const resp = await fetch(info.url, init);
            const headers = {};
            resp.headers.forEach((value, key) => {
                headers[key] = value;
            });
            return {
                url: resp.url,
                statusText: resp.statusText,
                httpVersion: 1,
                headers: headers,
                body: await resp.text(),
                status: resp.status,
            };
        }
        catch (e) {
            if (e.name === 'TimeoutError') {
                throw info.mkTimeoutError();
            }
            if (e instanceof TypeError && e.message === 'fetch failed' && 'cause' in e) {
                throw e.cause;
            }
            throw e;
        }
    }
        async close() { }
}
exports.FetchNative = FetchNative;
