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
import { diag } from '@opentelemetry/api';
import { ExportResultCode, getEnv } from '@opentelemetry/core';
import { prepareSend } from './platform/index';
import { toZipkinSpan, defaultStatusCodeTagName, defaultStatusErrorTagName, } from './transform';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { prepareGetHeaders } from './utils';
/**
 * Zipkin Exporter
 */
var ZipkinExporter = /** @class */ (function () {
    function ZipkinExporter(config) {
        if (config === void 0) { config = {}; }
        this.DEFAULT_SERVICE_NAME = 'OpenTelemetry Service';
        this._sendingPromises = [];
        this._urlStr = config.url || getEnv().OTEL_EXPORTER_ZIPKIN_ENDPOINT;
        this._send = prepareSend(this._urlStr, config.headers);
        this._serviceName = config.serviceName;
        this._statusCodeTagName =
            config.statusCodeTagName || defaultStatusCodeTagName;
        this._statusDescriptionTagName =
            config.statusDescriptionTagName || defaultStatusErrorTagName;
        this._isShutdown = false;
        if (typeof config.getExportRequestHeaders === 'function') {
            this._getHeaders = prepareGetHeaders(config.getExportRequestHeaders);
        }
        else {
            // noop
            this._beforeSend = function () { };
        }
    }
    /**
     * Export spans.
     */
    ZipkinExporter.prototype.export = function (spans, resultCallback) {
        var _this = this;
        var serviceName = String(this._serviceName ||
            spans[0].resource.attributes[SEMRESATTRS_SERVICE_NAME] ||
            this.DEFAULT_SERVICE_NAME);
        diag.debug('Zipkin exporter export');
        if (this._isShutdown) {
            setTimeout(function () {
                return resultCallback({
                    code: ExportResultCode.FAILED,
                    error: new Error('Exporter has been shutdown'),
                });
            });
            return;
        }
        var promise = new Promise(function (resolve) {
            _this._sendSpans(spans, serviceName, function (result) {
                resolve();
                resultCallback(result);
            });
        });
        this._sendingPromises.push(promise);
        var popPromise = function () {
            var index = _this._sendingPromises.indexOf(promise);
            _this._sendingPromises.splice(index, 1);
        };
        promise.then(popPromise, popPromise);
    };
    /**
     * Shutdown exporter. Noop operation in this exporter.
     */
    ZipkinExporter.prototype.shutdown = function () {
        diag.debug('Zipkin exporter shutdown');
        this._isShutdown = true;
        return this.forceFlush();
    };
    /**
     * Exports any pending spans in exporter
     */
    ZipkinExporter.prototype.forceFlush = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            Promise.all(_this._sendingPromises).then(function () {
                resolve();
            }, reject);
        });
    };
    /**
     * if user defines getExportRequestHeaders in config then this will be called
     * every time before send, otherwise it will be replaced with noop in
     * constructor
     * @default noop
     */
    ZipkinExporter.prototype._beforeSend = function () {
        if (this._getHeaders) {
            this._send = prepareSend(this._urlStr, this._getHeaders());
        }
    };
    /**
     * Transform spans and sends to Zipkin service.
     */
    ZipkinExporter.prototype._sendSpans = function (spans, serviceName, done) {
        var _this = this;
        var zipkinSpans = spans.map(function (span) {
            return toZipkinSpan(span, String(span.attributes[SEMRESATTRS_SERVICE_NAME] ||
                span.resource.attributes[SEMRESATTRS_SERVICE_NAME] ||
                serviceName), _this._statusCodeTagName, _this._statusDescriptionTagName);
        });
        this._beforeSend();
        return this._send(zipkinSpans, function (result) {
            if (done) {
                return done(result);
            }
        });
    };
    return ZipkinExporter;
}());
export { ZipkinExporter };
//# sourceMappingURL=zipkin.js.map