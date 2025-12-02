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
import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { Resource, } from '@opentelemetry/resources';
import { ATTR_AWS_ECS_CLUSTER_ARN, ATTR_AWS_ECS_CONTAINER_ARN, ATTR_AWS_ECS_LAUNCHTYPE, ATTR_AWS_ECS_TASK_ARN, ATTR_AWS_ECS_TASK_FAMILY, ATTR_AWS_ECS_TASK_REVISION, ATTR_AWS_LOG_GROUP_ARNS, ATTR_AWS_LOG_GROUP_NAMES, ATTR_AWS_LOG_STREAM_ARNS, ATTR_AWS_LOG_STREAM_NAMES, ATTR_CLOUD_ACCOUNT_ID, ATTR_CLOUD_AVAILABILITY_ZONE, ATTR_CLOUD_PLATFORM, ATTR_CLOUD_PROVIDER, ATTR_CLOUD_REGION, ATTR_CLOUD_RESOURCE_ID, ATTR_CONTAINER_ID, ATTR_CONTAINER_NAME, CLOUD_PROVIDER_VALUE_AWS, CLOUD_PLATFORM_VALUE_AWS_ECS, } from '../semconv';
import * as http from 'http';
import * as util from 'util';
import * as fs from 'fs';
import * as os from 'os';
var HTTP_TIMEOUT_IN_MS = 1000;
/**
 * The AwsEcsDetector can be used to detect if a process is running in AWS
 * ECS and return a {@link Resource} populated with data about the ECS
 * plugins of AWS X-Ray. Returns an empty Resource if detection fails.
 */
var AwsEcsDetectorSync = /** @class */ (function () {
    function AwsEcsDetectorSync() {
    }
    AwsEcsDetectorSync.prototype.detect = function () {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    AwsEcsDetectorSync.prototype._getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var resource, _a, _b, metadataUrl, _c, containerMetadata, taskMetadata, metadatav4Resource, logsResource, _d;
            var _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!process.env.ECS_CONTAINER_METADATA_URI_V4 &&
                            !process.env.ECS_CONTAINER_METADATA_URI) {
                            diag.debug('AwsEcsDetector failed: Process is not on ECS');
                            return [2 /*return*/, {}];
                        }
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 7, , 8]);
                        _b = (_a = new Resource((_e = {},
                            _e[ATTR_CLOUD_PROVIDER] = CLOUD_PROVIDER_VALUE_AWS,
                            _e[ATTR_CLOUD_PLATFORM] = CLOUD_PLATFORM_VALUE_AWS_ECS,
                            _e))).merge;
                        return [4 /*yield*/, AwsEcsDetectorSync._getContainerIdAndHostnameResource()];
                    case 2:
                        resource = _b.apply(_a, [_f.sent()]);
                        metadataUrl = process.env.ECS_CONTAINER_METADATA_URI_V4;
                        if (!metadataUrl) return [3 /*break*/, 6];
                        return [4 /*yield*/, Promise.all([
                                AwsEcsDetectorSync._getUrlAsJson(metadataUrl),
                                AwsEcsDetectorSync._getUrlAsJson(metadataUrl + "/task"),
                            ])];
                    case 3:
                        _c = _f.sent(), containerMetadata = _c[0], taskMetadata = _c[1];
                        return [4 /*yield*/, AwsEcsDetectorSync._getMetadataV4Resource(containerMetadata, taskMetadata)];
                    case 4:
                        metadatav4Resource = _f.sent();
                        return [4 /*yield*/, AwsEcsDetectorSync._getLogResource(containerMetadata)];
                    case 5:
                        logsResource = _f.sent();
                        resource = resource.merge(metadatav4Resource).merge(logsResource);
                        _f.label = 6;
                    case 6: return [2 /*return*/, resource.attributes];
                    case 7:
                        _d = _f.sent();
                        return [2 /*return*/, {}];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Read container ID from cgroup file
     * In ECS, even if we fail to find target file
     * or target file does not contain container ID
     * we do not throw an error but throw warning message
     * and then return null string
     */
    AwsEcsDetectorSync._getContainerIdAndHostnameResource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var hostName, containerId, rawData, splitData, _i, splitData_1, str, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        hostName = os.hostname();
                        containerId = '';
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, AwsEcsDetectorSync.readFileAsync(AwsEcsDetectorSync.DEFAULT_CGROUP_PATH, 'utf8')];
                    case 2:
                        rawData = _b.sent();
                        splitData = rawData.trim().split('\n');
                        for (_i = 0, splitData_1 = splitData; _i < splitData_1.length; _i++) {
                            str = splitData_1[_i];
                            if (str.length > AwsEcsDetectorSync.CONTAINER_ID_LENGTH) {
                                containerId = str.substring(str.length - AwsEcsDetectorSync.CONTAINER_ID_LENGTH);
                                break;
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _b.sent();
                        diag.debug('AwsEcsDetector failed to read container ID', e_1);
                        return [3 /*break*/, 4];
                    case 4:
                        if (hostName || containerId) {
                            return [2 /*return*/, new Resource((_a = {},
                                    _a[ATTR_CONTAINER_NAME] = hostName || '',
                                    _a[ATTR_CONTAINER_ID] = containerId || '',
                                    _a))];
                        }
                        return [2 /*return*/, Resource.empty()];
                }
            });
        });
    };
    AwsEcsDetectorSync._getMetadataV4Resource = function (containerMetadata, taskMetadata) {
        return __awaiter(this, void 0, void 0, function () {
            var launchType, taskArn, baseArn, cluster, accountId, region, availabilityZone, clusterArn, containerArn, attributes;
            var _a;
            return __generator(this, function (_b) {
                launchType = taskMetadata['LaunchType'];
                taskArn = taskMetadata['TaskARN'];
                baseArn = taskArn.substring(0, taskArn.lastIndexOf(':'));
                cluster = taskMetadata['Cluster'];
                accountId = AwsEcsDetectorSync._getAccountFromArn(taskArn);
                region = AwsEcsDetectorSync._getRegionFromArn(taskArn);
                availabilityZone = taskMetadata === null || taskMetadata === void 0 ? void 0 : taskMetadata.AvailabilityZone;
                clusterArn = cluster.startsWith('arn:')
                    ? cluster
                    : baseArn + ":cluster/" + cluster;
                containerArn = containerMetadata['ContainerARN'];
                attributes = (_a = {},
                    _a[ATTR_AWS_ECS_CONTAINER_ARN] = containerArn,
                    _a[ATTR_AWS_ECS_CLUSTER_ARN] = clusterArn,
                    _a[ATTR_AWS_ECS_LAUNCHTYPE] = launchType === null || launchType === void 0 ? void 0 : launchType.toLowerCase(),
                    _a[ATTR_AWS_ECS_TASK_ARN] = taskArn,
                    _a[ATTR_AWS_ECS_TASK_FAMILY] = taskMetadata['Family'],
                    _a[ATTR_AWS_ECS_TASK_REVISION] = taskMetadata['Revision'],
                    _a[ATTR_CLOUD_ACCOUNT_ID] = accountId,
                    _a[ATTR_CLOUD_REGION] = region,
                    _a[ATTR_CLOUD_RESOURCE_ID] = containerArn,
                    _a);
                // The availability zone is not available in all Fargate runtimes
                if (availabilityZone) {
                    attributes[ATTR_CLOUD_AVAILABILITY_ZONE] = availabilityZone;
                }
                return [2 /*return*/, new Resource(attributes)];
            });
        });
    };
    AwsEcsDetectorSync._getLogResource = function (containerMetadata) {
        return __awaiter(this, void 0, void 0, function () {
            var containerArn, logOptions, logsRegion, awsAccount, logsGroupName, logsGroupArn, logsStreamName, logsStreamArn;
            var _a;
            return __generator(this, function (_b) {
                if (containerMetadata['LogDriver'] !== 'awslogs' ||
                    !containerMetadata['LogOptions']) {
                    return [2 /*return*/, Resource.EMPTY];
                }
                containerArn = containerMetadata['ContainerARN'];
                logOptions = containerMetadata['LogOptions'];
                logsRegion = logOptions['awslogs-region'] ||
                    AwsEcsDetectorSync._getRegionFromArn(containerArn);
                awsAccount = AwsEcsDetectorSync._getAccountFromArn(containerArn);
                logsGroupName = logOptions['awslogs-group'];
                logsGroupArn = "arn:aws:logs:" + logsRegion + ":" + awsAccount + ":log-group:" + logsGroupName;
                logsStreamName = logOptions['awslogs-stream'];
                logsStreamArn = "arn:aws:logs:" + logsRegion + ":" + awsAccount + ":log-group:" + logsGroupName + ":log-stream:" + logsStreamName;
                return [2 /*return*/, new Resource((_a = {},
                        _a[ATTR_AWS_LOG_GROUP_NAMES] = [logsGroupName],
                        _a[ATTR_AWS_LOG_GROUP_ARNS] = [logsGroupArn],
                        _a[ATTR_AWS_LOG_STREAM_NAMES] = [logsStreamName],
                        _a[ATTR_AWS_LOG_STREAM_ARNS] = [logsStreamArn],
                        _a))];
            });
        });
    };
    AwsEcsDetectorSync._getAccountFromArn = function (containerArn) {
        var match = /arn:aws:ecs:[^:]+:([^:]+):.*/.exec(containerArn);
        return match[1];
    };
    AwsEcsDetectorSync._getRegionFromArn = function (containerArn) {
        var match = /arn:aws:ecs:([^:]+):.*/.exec(containerArn);
        return match[1];
    };
    AwsEcsDetectorSync._getUrlAsJson = function (url) {
        return new Promise(function (resolve, reject) {
            var request = http.get(url, function (response) {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error("Request to '" + url + "' failed with status " + response.statusCode));
                }
                /*
                 * Concatenate the response out of chunks:
                 * https://nodejs.org/api/stream.html#stream_event_data
                 */
                var responseBody = '';
                response.on('data', function (chunk) { return (responseBody += chunk.toString()); });
                // All the data has been read, resolve the Promise
                response.on('end', function () { return resolve(responseBody); });
                /*
                 * https://nodejs.org/api/http.html#httprequesturl-options-callback, see the
                 * 'In the case of a premature connection close after the response is received'
                 * case
                 */
                request.on('error', reject);
            });
            // Set an aggressive timeout to prevent lock-ups
            request.setTimeout(HTTP_TIMEOUT_IN_MS, function () {
                request.destroy();
            });
            // Connection error, disconnection, etc.
            request.on('error', reject);
            request.end();
        }).then(function (responseBodyRaw) { return JSON.parse(responseBodyRaw); });
    };
    AwsEcsDetectorSync.CONTAINER_ID_LENGTH = 64;
    AwsEcsDetectorSync.DEFAULT_CGROUP_PATH = '/proc/self/cgroup';
    AwsEcsDetectorSync.readFileAsync = util.promisify(fs.readFile);
    return AwsEcsDetectorSync;
}());
export { AwsEcsDetectorSync };
export var awsEcsDetectorSync = new AwsEcsDetectorSync();
//# sourceMappingURL=AwsEcsDetectorSync.js.map