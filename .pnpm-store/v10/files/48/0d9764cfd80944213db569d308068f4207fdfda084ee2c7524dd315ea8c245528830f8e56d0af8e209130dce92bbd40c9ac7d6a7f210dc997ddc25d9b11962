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
import * as http from 'http';
import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { Resource, } from '@opentelemetry/resources';
import { CLOUDPLATFORMVALUES_AZURE_VM, CLOUDPROVIDERVALUES_AZURE, SEMRESATTRS_CLOUD_PLATFORM, SEMRESATTRS_CLOUD_PROVIDER, SEMRESATTRS_CLOUD_REGION, SEMRESATTRS_HOST_ID, SEMRESATTRS_HOST_NAME, SEMRESATTRS_HOST_TYPE, SEMRESATTRS_OS_VERSION, } from '@opentelemetry/semantic-conventions';
import { CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE, AZURE_VM_METADATA_HOST, AZURE_VM_METADATA_PATH, AZURE_VM_SCALE_SET_NAME_ATTRIBUTE, AZURE_VM_SKU_ATTRIBUTE, } from '../types';
/**
 * The AzureVmDetector can be used to detect if a process is running in an Azure VM.
 * @returns a {@link Resource} populated with data about the environment or an empty Resource if detection fails.
 */
var AzureVmResourceDetector = /** @class */ (function () {
    function AzureVmResourceDetector() {
    }
    AzureVmResourceDetector.prototype.detect = function () {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this.getAzureVmMetadata();
        });
        return new Resource({}, attributes);
    };
    AzureVmResourceDetector.prototype.getAzureVmMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options, metadata, attributes;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            host: AZURE_VM_METADATA_HOST,
                            path: AZURE_VM_METADATA_PATH,
                            method: 'GET',
                            timeout: 5000,
                            headers: {
                                Metadata: 'True',
                            },
                        };
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var timeoutId = setTimeout(function () {
                                    req.destroy();
                                    reject(new Error('Azure metadata service request timed out.'));
                                }, 1000);
                                var req = http.request(options, function (res) {
                                    clearTimeout(timeoutId);
                                    var statusCode = res.statusCode;
                                    res.setEncoding('utf8');
                                    var rawData = '';
                                    res.on('data', function (chunk) { return (rawData += chunk); });
                                    res.on('end', function () {
                                        if (statusCode && statusCode >= 200 && statusCode < 300) {
                                            try {
                                                resolve(JSON.parse(rawData));
                                            }
                                            catch (error) {
                                                reject(error);
                                            }
                                        }
                                        else {
                                            reject(new Error('Failed to load page, status code: ' + statusCode));
                                        }
                                    });
                                });
                                req.on('error', function (err) {
                                    clearTimeout(timeoutId);
                                    reject(err);
                                });
                                req.end();
                            })];
                    case 1:
                        metadata = _b.sent();
                        attributes = (_a = {},
                            _a[AZURE_VM_SCALE_SET_NAME_ATTRIBUTE] = metadata['vmScaleSetName'],
                            _a[AZURE_VM_SKU_ATTRIBUTE] = metadata['sku'],
                            _a[SEMRESATTRS_CLOUD_PLATFORM] = CLOUDPLATFORMVALUES_AZURE_VM,
                            _a[SEMRESATTRS_CLOUD_PROVIDER] = CLOUDPROVIDERVALUES_AZURE,
                            _a[SEMRESATTRS_CLOUD_REGION] = metadata['location'],
                            _a[CLOUD_RESOURCE_ID_RESOURCE_ATTRIBUTE] = metadata['resourceId'],
                            _a[SEMRESATTRS_HOST_ID] = metadata['vmId'],
                            _a[SEMRESATTRS_HOST_NAME] = metadata['name'],
                            _a[SEMRESATTRS_HOST_TYPE] = metadata['vmSize'],
                            _a[SEMRESATTRS_OS_VERSION] = metadata['version'],
                            _a);
                        return [2 /*return*/, attributes];
                }
            });
        });
    };
    return AzureVmResourceDetector;
}());
export var azureVmDetector = new AzureVmResourceDetector();
//# sourceMappingURL=AzureVmDetector.js.map