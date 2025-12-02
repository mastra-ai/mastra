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
import { context } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { Resource, } from '@opentelemetry/resources';
import { CLOUDPLATFORMVALUES_ALIBABA_CLOUD_ECS, CLOUDPROVIDERVALUES_ALIBABA_CLOUD, SEMRESATTRS_CLOUD_ACCOUNT_ID, SEMRESATTRS_CLOUD_AVAILABILITY_ZONE, SEMRESATTRS_CLOUD_PLATFORM, SEMRESATTRS_CLOUD_PROVIDER, SEMRESATTRS_CLOUD_REGION, SEMRESATTRS_HOST_ID, SEMRESATTRS_HOST_NAME, SEMRESATTRS_HOST_TYPE, } from '@opentelemetry/semantic-conventions';
import * as http from 'http';
/**
 * The AlibabaCloudEcsDetector can be used to detect if a process is running in
 * AlibabaCloud ECS and return a {@link Resource} populated with metadata about
 * the ECS instance. Returns an empty Resource if detection fails.
 */
var AlibabaCloudEcsDetector = /** @class */ (function () {
    function AlibabaCloudEcsDetector() {
        /**
         * See https://www.alibabacloud.com/help/doc-detail/67254.htm for
         * documentation about the AlibabaCloud instance identity document.
         */
        this.ALIBABA_CLOUD_IDMS_ENDPOINT = '100.100.100.200';
        this.ALIBABA_CLOUD_INSTANCE_IDENTITY_DOCUMENT_PATH = '/latest/dynamic/instance-identity/document';
        this.ALIBABA_CLOUD_INSTANCE_HOST_DOCUMENT_PATH = '/latest/meta-data/hostname';
        this.MILLISECONDS_TIME_OUT = 1000;
    }
    /**
     * Attempts to connect and obtain an AlibabaCloud instance Identity document.
     * If the connection is successful it returns a promise containing a
     * {@link Resource} populated with instance metadata.
     *
     * @param config (unused) The resource detection config
     */
    AlibabaCloudEcsDetector.prototype.detect = function (_config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /** Gets identity and host info and returns them as attribs. Empty object if fails */
    AlibabaCloudEcsDetector.prototype._getAttributes = function (_config) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, accountId, instanceId, instanceType, region, availabilityZone, hostname;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this._fetchIdentity()];
                    case 1:
                        _a = _c.sent(), accountId = _a["owner-account-id"], instanceId = _a["instance-id"], instanceType = _a["instance-type"], region = _a["region-id"], availabilityZone = _a["zone-id"];
                        return [4 /*yield*/, this._fetchHost()];
                    case 2:
                        hostname = _c.sent();
                        return [2 /*return*/, (_b = {},
                                _b[SEMRESATTRS_CLOUD_PROVIDER] = CLOUDPROVIDERVALUES_ALIBABA_CLOUD,
                                _b[SEMRESATTRS_CLOUD_PLATFORM] = CLOUDPLATFORMVALUES_ALIBABA_CLOUD_ECS,
                                _b[SEMRESATTRS_CLOUD_ACCOUNT_ID] = accountId,
                                _b[SEMRESATTRS_CLOUD_REGION] = region,
                                _b[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE] = availabilityZone,
                                _b[SEMRESATTRS_HOST_ID] = instanceId,
                                _b[SEMRESATTRS_HOST_TYPE] = instanceType,
                                _b[SEMRESATTRS_HOST_NAME] = hostname,
                                _b)];
                }
            });
        });
    };
    /**
     * Fetch AlibabaCloud instance document url with http requests. If the
     * application is running on an ECS instance, we should be able to get back a
     * valid JSON document. Parses that document and stores the identity
     * properties in a local map.
     */
    AlibabaCloudEcsDetector.prototype._fetchIdentity = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options, identity;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            host: this.ALIBABA_CLOUD_IDMS_ENDPOINT,
                            path: this.ALIBABA_CLOUD_INSTANCE_IDENTITY_DOCUMENT_PATH,
                            method: 'GET',
                            timeout: this.MILLISECONDS_TIME_OUT,
                        };
                        return [4 /*yield*/, this._fetchString(options)];
                    case 1:
                        identity = _a.sent();
                        return [2 /*return*/, JSON.parse(identity)];
                }
            });
        });
    };
    AlibabaCloudEcsDetector.prototype._fetchHost = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            host: this.ALIBABA_CLOUD_IDMS_ENDPOINT,
                            path: this.ALIBABA_CLOUD_INSTANCE_HOST_DOCUMENT_PATH,
                            method: 'GET',
                            timeout: this.MILLISECONDS_TIME_OUT,
                        };
                        return [4 /*yield*/, this._fetchString(options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AlibabaCloudEcsDetector.prototype._fetchString = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var timeoutId = setTimeout(function () {
                            req.destroy(new Error('ECS metadata api request timed out.'));
                        }, _this.MILLISECONDS_TIME_OUT);
                        var req = http.request(options, function (res) {
                            clearTimeout(timeoutId);
                            var statusCode = res.statusCode;
                            if (typeof statusCode !== 'number' ||
                                !(statusCode >= 200 && statusCode < 300)) {
                                res.destroy();
                                return reject(new Error("Failed to load page, status code: " + statusCode));
                            }
                            res.setEncoding('utf8');
                            var rawData = '';
                            res.on('data', function (chunk) { return (rawData += chunk); });
                            res.on('error', function (err) {
                                reject(err);
                            });
                            res.on('end', function () {
                                resolve(rawData);
                            });
                        });
                        req.on('error', function (err) {
                            clearTimeout(timeoutId);
                            reject(err);
                        });
                        req.end();
                    })];
            });
        });
    };
    return AlibabaCloudEcsDetector;
}());
export var alibabaCloudEcsDetector = new AlibabaCloudEcsDetector();
//# sourceMappingURL=AlibabaCloudEcsDetector.js.map