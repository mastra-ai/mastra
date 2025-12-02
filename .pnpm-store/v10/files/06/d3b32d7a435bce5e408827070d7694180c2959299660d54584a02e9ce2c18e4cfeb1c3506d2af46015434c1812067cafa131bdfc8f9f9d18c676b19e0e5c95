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
import { ATTR_CLOUD_PROVIDER, ATTR_CLOUD_PLATFORM, ATTR_CLOUD_REGION, ATTR_CLOUD_ACCOUNT_ID, ATTR_CLOUD_AVAILABILITY_ZONE, ATTR_HOST_ID, ATTR_HOST_TYPE, ATTR_HOST_NAME, CLOUD_PROVIDER_VALUE_AWS, CLOUD_PLATFORM_VALUE_AWS_EC2, } from '../semconv';
import * as http from 'http';
/**
 * The AwsEc2DetectorSync can be used to detect if a process is running in AWS EC2
 * and return a {@link Resource} populated with metadata about the EC2
 * instance. Returns an empty Resource if detection fails.
 */
var AwsEc2DetectorSync = /** @class */ (function () {
    function AwsEc2DetectorSync() {
        /**
         * See https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-identity-documents.html
         * for documentation about the AWS instance identity document
         * and standard of IMDSv2.
         */
        this.AWS_IDMS_ENDPOINT = '169.254.169.254';
        this.AWS_INSTANCE_TOKEN_DOCUMENT_PATH = '/latest/api/token';
        this.AWS_INSTANCE_IDENTITY_DOCUMENT_PATH = '/latest/dynamic/instance-identity/document';
        this.AWS_INSTANCE_HOST_DOCUMENT_PATH = '/latest/meta-data/hostname';
        this.AWS_METADATA_TTL_HEADER = 'X-aws-ec2-metadata-token-ttl-seconds';
        this.AWS_METADATA_TOKEN_HEADER = 'X-aws-ec2-metadata-token';
        this.MILLISECOND_TIME_OUT = 5000;
    }
    AwsEc2DetectorSync.prototype.detect = function (_config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /**
     * Attempts to connect and obtain an AWS instance Identity document. If the
     * connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the identity
     * document fails.
     */
    AwsEc2DetectorSync.prototype._getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var token, _a, accountId, instanceId, instanceType, region, availabilityZone, hostname, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this._fetchToken()];
                    case 1:
                        token = _d.sent();
                        return [4 /*yield*/, this._fetchIdentity(token)];
                    case 2:
                        _a = _d.sent(), accountId = _a.accountId, instanceId = _a.instanceId, instanceType = _a.instanceType, region = _a.region, availabilityZone = _a.availabilityZone;
                        return [4 /*yield*/, this._fetchHost(token)];
                    case 3:
                        hostname = _d.sent();
                        return [2 /*return*/, (_c = {},
                                _c[ATTR_CLOUD_PROVIDER] = CLOUD_PROVIDER_VALUE_AWS,
                                _c[ATTR_CLOUD_PLATFORM] = CLOUD_PLATFORM_VALUE_AWS_EC2,
                                _c[ATTR_CLOUD_ACCOUNT_ID] = accountId,
                                _c[ATTR_CLOUD_REGION] = region,
                                _c[ATTR_CLOUD_AVAILABILITY_ZONE] = availabilityZone,
                                _c[ATTR_HOST_ID] = instanceId,
                                _c[ATTR_HOST_TYPE] = instanceType,
                                _c[ATTR_HOST_NAME] = hostname,
                                _c)];
                    case 4:
                        _b = _d.sent();
                        return [2 /*return*/, {}];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AwsEc2DetectorSync.prototype._fetchToken = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            host: this.AWS_IDMS_ENDPOINT,
                            path: this.AWS_INSTANCE_TOKEN_DOCUMENT_PATH,
                            method: 'PUT',
                            timeout: this.MILLISECOND_TIME_OUT,
                            headers: (_a = {},
                                _a[this.AWS_METADATA_TTL_HEADER] = '60',
                                _a),
                        };
                        return [4 /*yield*/, this._fetchString(options)];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    AwsEc2DetectorSync.prototype._fetchIdentity = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var options, identity;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            host: this.AWS_IDMS_ENDPOINT,
                            path: this.AWS_INSTANCE_IDENTITY_DOCUMENT_PATH,
                            method: 'GET',
                            timeout: this.MILLISECOND_TIME_OUT,
                            headers: (_a = {},
                                _a[this.AWS_METADATA_TOKEN_HEADER] = token,
                                _a),
                        };
                        return [4 /*yield*/, this._fetchString(options)];
                    case 1:
                        identity = _b.sent();
                        return [2 /*return*/, JSON.parse(identity)];
                }
            });
        });
    };
    AwsEc2DetectorSync.prototype._fetchHost = function (token) {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = {
                            host: this.AWS_IDMS_ENDPOINT,
                            path: this.AWS_INSTANCE_HOST_DOCUMENT_PATH,
                            method: 'GET',
                            timeout: this.MILLISECOND_TIME_OUT,
                            headers: (_a = {},
                                _a[this.AWS_METADATA_TOKEN_HEADER] = token,
                                _a),
                        };
                        return [4 /*yield*/, this._fetchString(options)];
                    case 1: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EC2 instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    AwsEc2DetectorSync.prototype._fetchString = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var timeoutId = setTimeout(function () {
                            req.abort();
                            reject(new Error('EC2 metadata api request timed out.'));
                        }, _this.MILLISECOND_TIME_OUT);
                        var req = http.request(options, function (res) {
                            clearTimeout(timeoutId);
                            var statusCode = res.statusCode;
                            res.setEncoding('utf8');
                            var rawData = '';
                            res.on('data', function (chunk) { return (rawData += chunk); });
                            res.on('end', function () {
                                if (statusCode && statusCode >= 200 && statusCode < 300) {
                                    try {
                                        resolve(rawData);
                                    }
                                    catch (e) {
                                        reject(e);
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
            });
        });
    };
    return AwsEc2DetectorSync;
}());
export var awsEc2DetectorSync = new AwsEc2DetectorSync();
//# sourceMappingURL=AwsEc2DetectorSync.js.map