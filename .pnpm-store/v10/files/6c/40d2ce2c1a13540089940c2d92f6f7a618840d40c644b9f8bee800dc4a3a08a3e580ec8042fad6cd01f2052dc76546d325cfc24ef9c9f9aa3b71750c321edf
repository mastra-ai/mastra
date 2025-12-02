"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containerDetector = exports.ContainerDetector = void 0;
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
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const fs = require("fs");
const util = require("util");
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const utils_1 = require("./utils");
class ContainerDetector {
    constructor() {
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
    detect(_config) {
        const attributes = api_1.context.with((0, core_1.suppressTracing)(api_1.context.active()), () => this._getAttributes());
        return new resources_1.Resource({}, attributes);
    }
    /**
     * Attempts to obtain the container ID from the file system. If the
     * file read is successful it returns a promise containing a {@link ResourceAttributes}
     * object with the container ID. Returns a promise containing an
     * empty {@link ResourceAttributes} if the paths do not exist or fail
     * to read.
     */
    async _getAttributes() {
        try {
            const containerId = await this._getContainerId();
            return !containerId
                ? {}
                : {
                    [semantic_conventions_1.SEMRESATTRS_CONTAINER_ID]: containerId,
                };
        }
        catch (e) {
            api_1.diag.debug('Container Detector did not identify running inside a supported container, no container attributes will be added to resource: ', e);
            return {};
        }
    }
    async _getContainerIdV1() {
        const rawData = await ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V1_PATH, this.UTF8_UNICODE);
        const splitData = rawData.trim().split('\n');
        for (const line of splitData) {
            const containerID = (0, utils_1.extractContainerIdFromLine)(line);
            if (containerID) {
                return containerID;
            }
        }
        return undefined;
    }
    async _getContainerIdV2() {
        var _a, _b;
        const rawData = await ContainerDetector.readFileAsync(this.DEFAULT_CGROUP_V2_PATH, this.UTF8_UNICODE);
        const str = rawData
            .trim()
            .split('\n')
            .find(s => s.includes(this.HOSTNAME));
        if (!str)
            return '';
        const strArray = (_a = str === null || str === void 0 ? void 0 : str.split('/')) !== null && _a !== void 0 ? _a : [];
        for (let i = 0; i < strArray.length - 1; i++) {
            if (this.MARKING_PREFIX.includes(strArray[i]) &&
                ((_b = strArray[i + 1]) === null || _b === void 0 ? void 0 : _b.length) === this.CONTAINER_ID_LENGTH) {
                return strArray[i + 1];
            }
        }
        return '';
    }
    /*
      cgroupv1 path would still exist in case of container running on v2
      but the cgroupv1 path would no longer have the container id and would
      fallback on the cgroupv2 implementation.
    */
    async _getContainerId() {
        try {
            const containerIdV1 = await this._getContainerIdV1();
            if (containerIdV1) {
                return containerIdV1; // If containerIdV1 is a non-empty string, return it.
            }
            const containerIdV2 = await this._getContainerIdV2();
            if (containerIdV2) {
                return containerIdV2; // If containerIdV2 is a non-empty string, return it.
            }
        }
        catch (e) {
            if (e instanceof Error) {
                const errorMessage = e.message;
                api_1.diag.debug('Container Detector failed to read the Container ID: ', errorMessage);
            }
        }
        return undefined; // Explicitly return undefined if neither ID is found.
    }
}
exports.ContainerDetector = ContainerDetector;
ContainerDetector.readFileAsync = util.promisify(fs.readFile);
exports.containerDetector = new ContainerDetector();
//# sourceMappingURL=ContainerDetector.js.map