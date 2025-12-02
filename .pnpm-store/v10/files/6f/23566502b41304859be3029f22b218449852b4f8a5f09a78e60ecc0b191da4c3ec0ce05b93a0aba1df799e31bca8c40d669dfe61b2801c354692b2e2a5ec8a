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
import { Resource, } from '@opentelemetry/resources';
import { SEMRESATTRS_CONTAINER_ID } from '@opentelemetry/semantic-conventions';
import * as fs from 'fs';
import * as util from 'util';
import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { extractContainerIdFromLine } from './utils';
var ContainerDetector = /** @class */ (function () {
    function ContainerDetector() {
        this.CONTAINER_ID_LENGTH = 64;
        this.DEFAULT_CGROUP_V1_PATH = '/proc/self/cgroup';
        this.DEFAULT_CGROUP_V2_PATH = '/proc/self/mountinfo';
        this.UTF8_UNICODE = 'utf8';
        this.HOSTNAME = 'hostname';
        this.MARKING_PREFIX = ['containers', 'overlay-containers'];
        this.CRIO = 'crio-';
        this.CRI_CONTAINERD = 'cri-containerd-';
        this.DOCKER = 'docker-';
        this.HEX_STRING_REGEX = /^[a-f0-9]+$/i;
    }
    ContainerDetector.prototype.detect = function (_config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /**
     * Attempts to obtain the container ID from the file system. If the
     * file read is successful it returns a promise containing a {@link ResourceAttributes}
     * object with the container ID. Returns a promise containing an
     * empty {@link ResourceAttributes} if the paths do not exist or fail
     * to read.
     */
    ContainerDetector.prototype._getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var containerId, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this._getContainerId()];
                    case 1:
                        containerId = _b.sent();
                        return [2 /*return*/, !containerId
                                ? {}
                                : (_a = {},
                                    _a[SEMRESATTRS_CONTAINER_ID] = containerId,
                                    _a)];
                    case 2:
                        e_1 = _b.sent();
                        diag.debug('Container Detector did not identify running inside a supported container, no container attributes will be added to resource: ', e_1);
                        return [2 /*return*/, {}];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ContainerDetector.prototype._getContainerIdV1 = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, splitData, _i, splitData_1, line, containerID;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V1_PATH, this.UTF8_UNICODE)];
                    case 1:
                        rawData = _a.sent();
                        splitData = rawData.trim().split('\n');
                        for (_i = 0, splitData_1 = splitData; _i < splitData_1.length; _i++) {
                            line = splitData_1[_i];
                            containerID = extractContainerIdFromLine(line);
                            if (containerID) {
                                return [2 /*return*/, containerID];
                            }
                        }
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    ContainerDetector.prototype._getContainerIdV2 = function () {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var rawData, str, strArray, i;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V2_PATH, this.UTF8_UNICODE)];
                    case 1:
                        rawData = _c.sent();
                        str = rawData
                            .trim()
                            .split('\n')
                            .find(function (s) { return s.includes(_this.HOSTNAME); });
                        if (!str)
                            return [2 /*return*/, ''];
                        strArray = (_a = str === null || str === void 0 ? void 0 : str.split('/')) !== null && _a !== void 0 ? _a : [];
                        for (i = 0; i < strArray.length - 1; i++) {
                            if (this.MARKING_PREFIX.includes(strArray[i]) &&
                                ((_b = strArray[i + 1]) === null || _b === void 0 ? void 0 : _b.length) === this.CONTAINER_ID_LENGTH) {
                                return [2 /*return*/, strArray[i + 1]];
                            }
                        }
                        return [2 /*return*/, ''];
                }
            });
        });
    };
    /*
      cgroupv1 path would still exist in case of container running on v2
      but the cgroupv1 path would no longer have the container id and would
      fallback on the cgroupv2 implementation.
    */
    ContainerDetector.prototype._getContainerId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var containerIdV1, containerIdV2, e_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this._getContainerIdV1()];
                    case 1:
                        containerIdV1 = _a.sent();
                        if (containerIdV1) {
                            return [2 /*return*/, containerIdV1]; // If containerIdV1 is a non-empty string, return it.
                        }
                        return [4 /*yield*/, this._getContainerIdV2()];
                    case 2:
                        containerIdV2 = _a.sent();
                        if (containerIdV2) {
                            return [2 /*return*/, containerIdV2]; // If containerIdV2 is a non-empty string, return it.
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        e_2 = _a.sent();
                        if (e_2 instanceof Error) {
                            errorMessage = e_2.message;
                            diag.debug('Container Detector failed to read the Container ID: ', errorMessage);
                        }
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, undefined]; // Explicitly return undefined if neither ID is found.
                }
            });
        });
    };
    ContainerDetector.readFileAsync = util.promisify(fs.readFile);
    return ContainerDetector;
}());
export { ContainerDetector };
export var containerDetector = new ContainerDetector();
//# sourceMappingURL=ContainerDetector.js.map