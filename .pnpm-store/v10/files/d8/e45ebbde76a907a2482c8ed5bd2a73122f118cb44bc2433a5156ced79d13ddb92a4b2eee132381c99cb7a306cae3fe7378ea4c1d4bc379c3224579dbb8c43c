"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.gcpDetector = void 0;
const gcpMetadata = require("gcp-metadata");
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/**
 * The GcpDetector can be used to detect if a process is running in the Google
 * Cloud Platform and return a {@link Resource} populated with metadata about
 * the instance. Returns an empty Resource if detection fails.
 */
class GcpDetector {
    detect(_config) {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._getAttributes());
        return new resources_1.Resource({}, attributes);
    }
    /**
     * Attempts to connect and obtain instance configuration data from the GCP metadata service.
     * If the connection is successful it returns a promise containing a {@link ResourceAttributes}
     * object with instance metadata. Returns a promise containing an
     * empty {@link ResourceAttributes} if the connection or parsing of the metadata fails.
     */
    async _getAttributes() {
        if (!(await gcpMetadata.isAvailable())) {
            api_1.diag.debug('GcpDetector failed: GCP Metadata unavailable.');
            return {};
        }
        const [projectId, instanceId, zoneId, clusterName, hostname] = await Promise.all([
            this._getProjectId(),
            this._getInstanceId(),
            this._getZone(),
            this._getClusterName(),
            this._getHostname(),
        ]);
        const attributes = {};
        attributes[semantic_conventions_1.SEMRESATTRS_CLOUD_ACCOUNT_ID] = projectId;
        attributes[semantic_conventions_1.SEMRESATTRS_HOST_ID] = instanceId;
        attributes[semantic_conventions_1.SEMRESATTRS_HOST_NAME] = hostname;
        attributes[semantic_conventions_1.SEMRESATTRS_CLOUD_AVAILABILITY_ZONE] = zoneId;
        attributes[semantic_conventions_1.SEMRESATTRS_CLOUD_PROVIDER] = semantic_conventions_1.CLOUDPROVIDERVALUES_GCP;
        if (process.env.KUBERNETES_SERVICE_HOST)
            this._addK8sAttributes(attributes, clusterName);
        return attributes;
    }
    /** Add resource attributes for K8s */
    _addK8sAttributes(attributes, clusterName) {
        var _a, _b, _c;
        attributes[semantic_conventions_1.SEMRESATTRS_K8S_CLUSTER_NAME] = clusterName;
        attributes[semantic_conventions_1.SEMRESATTRS_K8S_NAMESPACE_NAME] = (_a = process.env.NAMESPACE) !== null && _a !== void 0 ? _a : '';
        attributes[semantic_conventions_1.SEMRESATTRS_K8S_POD_NAME] = (_b = process.env.HOSTNAME) !== null && _b !== void 0 ? _b : '';
        attributes[semantic_conventions_1.SEMRESATTRS_CONTAINER_NAME] = (_c = process.env.CONTAINER_NAME) !== null && _c !== void 0 ? _c : '';
    }
    /** Gets project id from GCP project metadata. */
    async _getProjectId() {
        try {
            return await gcpMetadata.project('project-id');
        }
        catch (_a) {
            return '';
        }
    }
    /** Gets instance id from GCP instance metadata. */
    async _getInstanceId() {
        try {
            const id = await gcpMetadata.instance('id');
            return id.toString();
        }
        catch (_a) {
            return '';
        }
    }
    /** Gets zone from GCP instance metadata. */
    async _getZone() {
        try {
            const zoneId = await gcpMetadata.instance('zone');
            if (zoneId) {
                return zoneId.split('/').pop();
            }
            return '';
        }
        catch (_a) {
            return '';
        }
    }
    /** Gets cluster name from GCP instance metadata. */
    async _getClusterName() {
        try {
            return await gcpMetadata.instance('attributes/cluster-name');
        }
        catch (_a) {
            return '';
        }
    }
    /** Gets hostname from GCP instance metadata. */
    async _getHostname() {
        try {
            return await gcpMetadata.instance('hostname');
        }
        catch (_a) {
            return '';
        }
    }
}
exports.gcpDetector = new GcpDetector();
//# sourceMappingURL=GcpDetector.js.map