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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { ExportResultCode } from '@opentelemetry/core';
import { OTLPExporterError } from './types';
import { createLoggingPartialSuccessResponseHandler } from './logging-response-handler';
import { diag } from '@opentelemetry/api';
var OTLPExportDelegate = /** @class */ (function () {
    function OTLPExportDelegate(_transport, _serializer, _responseHandler, _promiseQueue, _timeout) {
        this._transport = _transport;
        this._serializer = _serializer;
        this._responseHandler = _responseHandler;
        this._promiseQueue = _promiseQueue;
        this._timeout = _timeout;
        this._diagLogger = diag.createComponentLogger({
            namespace: 'OTLPExportDelegate',
        });
    }
    OTLPExportDelegate.prototype.export = function (internalRepresentation, resultCallback) {
        var _this = this;
        this._diagLogger.debug('items to be sent', internalRepresentation);
        // don't do any work if too many exports are in progress.
        if (this._promiseQueue.hasReachedLimit()) {
            resultCallback({
                code: ExportResultCode.FAILED,
                error: new Error('Concurrent export limit reached'),
            });
            return;
        }
        var serializedRequest = this._serializer.serializeRequest(internalRepresentation);
        if (serializedRequest == null) {
            resultCallback({
                code: ExportResultCode.FAILED,
                error: new Error('Nothing to send'),
            });
            return;
        }
        this._promiseQueue.pushPromise(this._transport.send(serializedRequest, this._timeout).then(function (response) {
            if (response.status === 'success') {
                if (response.data != null) {
                    try {
                        _this._responseHandler.handleResponse(_this._serializer.deserializeResponse(response.data));
                    }
                    catch (e) {
                        _this._diagLogger.warn('Export succeeded but could not deserialize response - is the response specification compliant?', e, response.data);
                    }
                }
                // No matter the response, we can consider the export still successful.
                resultCallback({
                    code: ExportResultCode.SUCCESS,
                });
                return;
            }
            else if (response.status === 'failure' && response.error) {
                resultCallback({
                    code: ExportResultCode.FAILED,
                    error: response.error,
                });
                return;
            }
            else if (response.status === 'retryable') {
                resultCallback({
                    code: ExportResultCode.FAILED,
                    error: new OTLPExporterError('Export failed with retryable status'),
                });
            }
            else {
                resultCallback({
                    code: ExportResultCode.FAILED,
                    error: new OTLPExporterError('Export failed with unknown error'),
                });
            }
        }, function (reason) {
            return resultCallback({
                code: ExportResultCode.FAILED,
                error: reason,
            });
        }));
    };
    OTLPExportDelegate.prototype.forceFlush = function () {
        return this._promiseQueue.awaitAll();
    };
    OTLPExportDelegate.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._diagLogger.debug('shutdown started');
                        return [4 /*yield*/, this.forceFlush()];
                    case 1:
                        _a.sent();
                        this._transport.shutdown();
                        return [2 /*return*/];
                }
            });
        });
    };
    return OTLPExportDelegate;
}());
/**
 * Creates a generic delegate for OTLP exports which only contains parts of the OTLP export that are shared across all
 * signals.
 */
export function createOtlpExportDelegate(components, settings) {
    return new OTLPExportDelegate(components.transport, components.serializer, createLoggingPartialSuccessResponseHandler(), components.promiseHandler, settings.timeout);
}
//# sourceMappingURL=otlp-export-delegate.js.map