"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractContainerIdFromLine = exports.truncatePrefix = exports.HEX_STRING_REGEX = exports.DOCKER = exports.CRI_CONTAINERD = exports.CRIO = exports.MARKING_PREFIX = exports.HOSTNAME = exports.UTF8_UNICODE = exports.DEFAULT_CGROUP_V2_PATH = exports.DEFAULT_CGROUP_V1_PATH = exports.CONTAINER_ID_LENGTH = void 0;
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
exports.CONTAINER_ID_LENGTH = 64;
exports.DEFAULT_CGROUP_V1_PATH = '/proc/self/cgroup';
exports.DEFAULT_CGROUP_V2_PATH = '/proc/self/mountinfo';
exports.UTF8_UNICODE = 'utf8';
exports.HOSTNAME = 'hostname';
exports.MARKING_PREFIX = ['containers', 'overlay-containers'];
exports.CRIO = 'crio-';
exports.CRI_CONTAINERD = 'cri-containerd-';
exports.DOCKER = 'docker-';
exports.HEX_STRING_REGEX = /^[a-f0-9]+$/i;
function truncatePrefix(lastSection, prefix) {
    return lastSection.substring(prefix.length);
}
exports.truncatePrefix = truncatePrefix;
function extractContainerIdFromLine(line) {
    if (!line) {
        return undefined;
    }
    const sections = line.split('/');
    if (sections.length <= 1) {
        return undefined;
    }
    let lastSection = sections[sections.length - 1];
    // Handle containerd v1.5.0+ format with systemd cgroup driver
    const colonIndex = lastSection.lastIndexOf(':');
    if (colonIndex !== -1) {
        lastSection = lastSection.substring(colonIndex + 1);
    }
    // Truncate known prefixes from the last section
    if (lastSection.startsWith(exports.CRIO)) {
        lastSection = truncatePrefix(lastSection, exports.CRIO);
    }
    else if (lastSection.startsWith(exports.DOCKER)) {
        lastSection = truncatePrefix(lastSection, exports.DOCKER);
    }
    else if (lastSection.startsWith(exports.CRI_CONTAINERD)) {
        lastSection = truncatePrefix(lastSection, exports.CRI_CONTAINERD);
    }
    // Remove anything after the first period
    if (lastSection.includes('.')) {
        lastSection = lastSection.split('.')[0];
    }
    // Check if the remaining string is a valid hex string
    if (exports.HEX_STRING_REGEX.test(lastSection)) {
        return lastSection;
    }
    return undefined;
}
exports.extractContainerIdFromLine = extractContainerIdFromLine;
//# sourceMappingURL=utils.js.map