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
import { ATTR_CLOUD_PROVIDER, ATTR_CLOUD_PLATFORM, ATTR_K8S_CLUSTER_NAME, ATTR_CONTAINER_ID, CLOUD_PROVIDER_VALUE_AWS, CLOUD_PLATFORM_VALUE_AWS_EKS, } from '../semconv';
import * as https from 'https';
import * as fs from 'fs';
import * as util from 'util';
import { diag } from '@opentelemetry/api';
/**
 * The AwsEksDetectorSync can be used to detect if a process is running in AWS Elastic
 * Kubernetes and return a {@link Resource} populated with data about the Kubernetes
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 *
 * See https://docs.amazonaws.cn/en_us/xray/latest/devguide/xray-guide.pdf
 * for more details about detecting information for Elastic Kubernetes plugins
 */
var AwsEksDetectorSync = /** @class */ (function () {
    function AwsEksDetectorSync() {
        this.K8S_SVC_URL = 'kubernetes.default.svc';
        this.K8S_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
        this.K8S_CERT_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
        this.AUTH_CONFIGMAP_PATH = '/api/v1/namespaces/kube-system/configmaps/aws-auth';
        this.CW_CONFIGMAP_PATH = '/api/v1/namespaces/amazon-cloudwatch/configmaps/cluster-info';
        this.CONTAINER_ID_LENGTH = 64;
        this.DEFAULT_CGROUP_PATH = '/proc/self/cgroup';
        this.TIMEOUT_MS = 2000;
        this.UTF8_UNICODE = 'utf8';
    }
    AwsEksDetectorSync.prototype.detect = function (_config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /**
     * The AwsEksDetector can be used to detect if a process is running on Amazon
     * Elastic Kubernetes and returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection to kubernetes process
     * or aws config maps fails
     */
    AwsEksDetectorSync.prototype._getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var k8scert, containerId, clusterName, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, AwsEksDetectorSync.fileAccessAsync(this.K8S_TOKEN_PATH)];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, AwsEksDetectorSync.readFileAsync(this.K8S_CERT_PATH)];
                    case 2:
                        k8scert = _b.sent();
                        return [4 /*yield*/, this._isEks(k8scert)];
                    case 3:
                        if (!(_b.sent())) {
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, this._getContainerId()];
                    case 4:
                        containerId = _b.sent();
                        return [4 /*yield*/, this._getClusterName(k8scert)];
                    case 5:
                        clusterName = _b.sent();
                        return [2 /*return*/, !containerId && !clusterName
                                ? {}
                                : (_a = {},
                                    _a[ATTR_CLOUD_PROVIDER] = CLOUD_PROVIDER_VALUE_AWS,
                                    _a[ATTR_CLOUD_PLATFORM] = CLOUD_PLATFORM_VALUE_AWS_EKS,
                                    _a[ATTR_K8S_CLUSTER_NAME] = clusterName || '',
                                    _a[ATTR_CONTAINER_ID] = containerId || '',
                                    _a)];
                    case 6:
                        e_1 = _b.sent();
                        diag.debug('Process is not running on K8S', e_1);
                        return [2 /*return*/, {}];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Attempts to make a connection to AWS Config map which will
     * determine whether the process is running on an EKS
     * process if the config map is empty or not
     */
    AwsEksDetectorSync.prototype._isEks = function (cert) {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = {
                            ca: cert
                        };
                        _b = {};
                        return [4 /*yield*/, this._getK8sCredHeader()];
                    case 1:
                        options = (_a.headers = (_b.Authorization = _c.sent(),
                            _b),
                            _a.hostname = this.K8S_SVC_URL,
                            _a.method = 'GET',
                            _a.path = this.AUTH_CONFIGMAP_PATH,
                            _a.timeout = this.TIMEOUT_MS,
                            _a);
                        return [4 /*yield*/, this._fetchString(options)];
                    case 2: return [2 /*return*/, !!(_c.sent())];
                }
            });
        });
    };
    /**
     * Attempts to make a connection to Amazon Cloudwatch
     * Config Maps to grab cluster name
     */
    AwsEksDetectorSync.prototype._getClusterName = function (cert) {
        return __awaiter(this, void 0, void 0, function () {
            var options, response;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = {
                            ca: cert
                        };
                        _b = {};
                        return [4 /*yield*/, this._getK8sCredHeader()];
                    case 1:
                        options = (_a.headers = (_b.Authorization = _c.sent(),
                            _b),
                            _a.host = this.K8S_SVC_URL,
                            _a.method = 'GET',
                            _a.path = this.CW_CONFIGMAP_PATH,
                            _a.timeout = this.TIMEOUT_MS,
                            _a);
                        return [4 /*yield*/, this._fetchString(options)];
                    case 2:
                        response = _c.sent();
                        try {
                            return [2 /*return*/, JSON.parse(response).data['cluster.name']];
                        }
                        catch (e) {
                            diag.debug('Cannot get cluster name on EKS', e);
                        }
                        return [2 /*return*/, ''];
                }
            });
        });
    };
    /**
     * Reads the Kubernetes token path and returns kubernetes
     * credential header
     */
    AwsEksDetectorSync.prototype._getK8sCredHeader = function () {
        return __awaiter(this, void 0, void 0, function () {
            var content, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, AwsEksDetectorSync.readFileAsync(this.K8S_TOKEN_PATH, this.UTF8_UNICODE)];
                    case 1:
                        content = _a.sent();
                        return [2 /*return*/, 'Bearer ' + content];
                    case 2:
                        e_2 = _a.sent();
                        diag.debug('Unable to read Kubernetes client token.', e_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, ''];
                }
            });
        });
    };
    /**
     * Read container ID from cgroup file generated from docker which lists the full
     * untruncated docker container ID at the end of each line.
     *
     * The predefined structure of calling /proc/self/cgroup when in a docker container has the structure:
     *
     * #:xxxxxx:/
     *
     * or
     *
     * #:xxxxxx:/docker/64characterID
     *
     * This function takes advantage of that fact by just reading the 64-character ID from the end of the
     * first line. In EKS, even if we fail to find target file or target file does
     * not contain container ID we do not throw an error but throw warning message
     * and then return null string
     */
    AwsEksDetectorSync.prototype._getContainerId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, splitData, _i, splitData_1, str, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, AwsEksDetectorSync.readFileAsync(this.DEFAULT_CGROUP_PATH, this.UTF8_UNICODE)];
                    case 1:
                        rawData = _a.sent();
                        splitData = rawData.trim().split('\n');
                        for (_i = 0, splitData_1 = splitData; _i < splitData_1.length; _i++) {
                            str = splitData_1[_i];
                            if (str.length > this.CONTAINER_ID_LENGTH) {
                                return [2 /*return*/, str.substring(str.length - this.CONTAINER_ID_LENGTH)];
                            }
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        e_3 = _a.sent();
                        diag.debug("AwsEksDetector failed to read container ID: " + e_3.message);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/, undefined];
                }
            });
        });
    };
    /**
     * Establishes an HTTP connection to AWS instance document url.
     * If the application is running on an EKS instance, we should be able
     * to get back a valid JSON document. Parses that document and stores
     * the identity properties in a local map.
     */
    AwsEksDetectorSync.prototype._fetchString = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var timeoutId = setTimeout(function () {
                                req.abort();
                                reject(new Error('EKS metadata api request timed out.'));
                            }, 2000);
                            var req = https.request(options, function (res) {
                                clearTimeout(timeoutId);
                                var statusCode = res.statusCode;
                                res.setEncoding(_this.UTF8_UNICODE);
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
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AwsEksDetectorSync.readFileAsync = util.promisify(fs.readFile);
    AwsEksDetectorSync.fileAccessAsync = util.promisify(fs.access);
    return AwsEksDetectorSync;
}());
export { AwsEksDetectorSync };
export var awsEksDetectorSync = new AwsEksDetectorSync();
//# sourceMappingURL=AwsEksDetectorSync.js.map