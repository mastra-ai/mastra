/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { diag } from '@opentelemetry/api';
import { ExportResultCode } from '@opentelemetry/core';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
/**
 * Prepares send function that will send spans to the remote Zipkin service.
 * @param urlStr - url to send spans
 * @param headers - headers
 * send
 */
export function prepareSend(urlStr, headers) {
    var urlOpts = url.parse(urlStr);
    var reqOpts = Object.assign({
        method: 'POST',
        headers: __assign({ 'Content-Type': 'application/json' }, headers),
    }, urlOpts);
    /**
     * Send spans to the remote Zipkin service.
     */
    return function send(zipkinSpans, done) {
        if (zipkinSpans.length === 0) {
            diag.debug('Zipkin send with empty spans');
            return done({ code: ExportResultCode.SUCCESS });
        }
        var request = (reqOpts.protocol === 'http:' ? http : https).request;
        var req = request(reqOpts, function (res) {
            var rawData = '';
            res.on('data', function (chunk) {
                rawData += chunk;
            });
            res.on('end', function () {
                var statusCode = res.statusCode || 0;
                diag.debug("Zipkin response status code: " + statusCode + ", body: " + rawData);
                // Consider 2xx and 3xx as success.
                if (statusCode < 400) {
                    return done({ code: ExportResultCode.SUCCESS });
                    // Consider 4xx as failed non-retryable.
                }
                else {
                    return done({
                        code: ExportResultCode.FAILED,
                        error: new Error("Got unexpected status code from zipkin: " + statusCode),
                    });
                }
            });
        });
        req.on('error', function (error) {
            return done({
                code: ExportResultCode.FAILED,
                error: error,
            });
        });
        // Issue request to remote service
        var payload = JSON.stringify(zipkinSpans);
        diag.debug("Zipkin request payload: " + payload);
        req.write(payload, 'utf8');
        req.end();
    };
}
//# sourceMappingURL=util.js.map