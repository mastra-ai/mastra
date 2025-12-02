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
import * as gcpMetadata from 'gcp-metadata';
import { context, diag } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import { Resource, } from '@opentelemetry/resources';
import { CLOUDPROVIDERVALUES_GCP, SEMRESATTRS_CLOUD_ACCOUNT_ID, SEMRESATTRS_CLOUD_AVAILABILITY_ZONE, SEMRESATTRS_CLOUD_PROVIDER, SEMRESATTRS_CONTAINER_NAME, SEMRESATTRS_HOST_ID, SEMRESATTRS_HOST_NAME, SEMRESATTRS_K8S_CLUSTER_NAME, SEMRESATTRS_K8S_NAMESPACE_NAME, SEMRESATTRS_K8S_POD_NAME, } from '@opentelemetry/semantic-conventions';
/**
 * The GcpDetector can be used to detect if a process is running in the Google
 * Cloud Platform and return a {@link Resource} populated with metadata about
 * the instance. Returns an empty Resource if detection fails.
 */
var GcpDetector = /** @class */ (function () {
    function GcpDetector() {
    }
    GcpDetector.prototype.detect = function (_config) {
        var _this = this;
        var attributes = context.with(suppressTracing(context.active()), function () {
            return _this._getAttributes();
        });
        return new Resource({}, attributes);
    };
    /**
     * Attempts to connect and obtain instance configuration data from the GCP metadata service.
     * If the connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the metadata fails.
     */
    GcpDetector.prototype._getAttributes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, projectId, instanceId, zoneId, clusterName, hostname, attributes;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, gcpMetadata.isAvailable()];
                    case 1:
                        if (!(_b.sent())) {
                            diag.debug('GcpDetector failed: GCP Metadata unavailable.');
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, Promise.all([
                                this._getProjectId(),
                                this._getInstanceId(),
                                this._getZone(),
                                this._getClusterName(),
                                this._getHostname(),
                            ])];
                    case 2:
                        _a = _b.sent(), projectId = _a[0], instanceId = _a[1], zoneId = _a[2], clusterName = _a[3], hostname = _a[4];
                        attributes = {};
                        attributes[SEMRESATTRS_CLOUD_ACCOUNT_ID] = projectId;
                        attributes[SEMRESATTRS_HOST_ID] = instanceId;
                        attributes[SEMRESATTRS_HOST_NAME] = hostname;
                        attributes[SEMRESATTRS_CLOUD_AVAILABILITY_ZONE] = zoneId;
                        attributes[SEMRESATTRS_CLOUD_PROVIDER] = CLOUDPROVIDERVALUES_GCP;
                        if (process.env.KUBERNETES_SERVICE_HOST)
                            this._addK8sAttributes(attributes, clusterName);
                        return [2 /*return*/, attributes];
                }
            });
        });
    };
    /** Add resource attributes for K8s */
    GcpDetector.prototype._addK8sAttributes = function (attributes, clusterName) {
        var _a, _b, _c;
        attributes[SEMRESATTRS_K8S_CLUSTER_NAME] = clusterName;
        attributes[SEMRESATTRS_K8S_NAMESPACE_NAME] = (_a = process.env.NAMESPACE) !== null && _a !== void 0 ? _a : '';
        attributes[SEMRESATTRS_K8S_POD_NAME] = (_b = process.env.HOSTNAME) !== null && _b !== void 0 ? _b : '';
        attributes[SEMRESATTRS_CONTAINER_NAME] = (_c = process.env.CONTAINER_NAME) !== null && _c !== void 0 ? _c : '';
    };
    /** Gets project id from GCP project metadata. */
    GcpDetector.prototype._getProjectId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, gcpMetadata.project('project-id')];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Gets instance id from GCP instance metadata. */
    GcpDetector.prototype._getInstanceId = function () {
        return __awaiter(this, void 0, void 0, function () {
            var id, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, gcpMetadata.instance('id')];
                    case 1:
                        id = _b.sent();
                        return [2 /*return*/, id.toString()];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Gets zone from GCP instance metadata. */
    GcpDetector.prototype._getZone = function () {
        return __awaiter(this, void 0, void 0, function () {
            var zoneId, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, gcpMetadata.instance('zone')];
                    case 1:
                        zoneId = _b.sent();
                        if (zoneId) {
                            return [2 /*return*/, zoneId.split('/').pop()];
                        }
                        return [2 /*return*/, ''];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Gets cluster name from GCP instance metadata. */
    GcpDetector.prototype._getClusterName = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, gcpMetadata.instance('attributes/cluster-name')];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /** Gets hostname from GCP instance metadata. */
    GcpDetector.prototype._getHostname = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, gcpMetadata.instance('hostname')];
                    case 1: return [2 /*return*/, _b.sent()];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, ''];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return GcpDetector;
}());
export var gcpDetector = new GcpDetector();
//# sourceMappingURL=GcpDetector.js.map