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
export var CONTAINER_ID_LENGTH = 64;
export var DEFAULT_CGROUP_V1_PATH = '/proc/self/cgroup';
export var DEFAULT_CGROUP_V2_PATH = '/proc/self/mountinfo';
export var UTF8_UNICODE = 'utf8';
export var HOSTNAME = 'hostname';
export var MARKING_PREFIX = ['containers', 'overlay-containers'];
export var CRIO = 'crio-';
export var CRI_CONTAINERD = 'cri-containerd-';
export var DOCKER = 'docker-';
export var HEX_STRING_REGEX = /^[a-f0-9]+$/i;
export function truncatePrefix(lastSection, prefix) {
    return lastSection.substring(prefix.length);
}
export function extractContainerIdFromLine(line) {
    if (!line) {
        return undefined;
    }
    var sections = line.split('/');
    if (sections.length <= 1) {
        return undefined;
    }
    var lastSection = sections[sections.length - 1];
    // Handle containerd v1.5.0+ format with systemd cgroup driver
    var colonIndex = lastSection.lastIndexOf(':');
    if (colonIndex !== -1) {
        lastSection = lastSection.substring(colonIndex + 1);
    }
    // Truncate known prefixes from the last section
    if (lastSection.startsWith(CRIO)) {
        lastSection = truncatePrefix(lastSection, CRIO);
    }
    else if (lastSection.startsWith(DOCKER)) {
        lastSection = truncatePrefix(lastSection, DOCKER);
    }
    else if (lastSection.startsWith(CRI_CONTAINERD)) {
        lastSection = truncatePrefix(lastSection, CRI_CONTAINERD);
    }
    // Remove anything after the first period
    if (lastSection.includes('.')) {
        lastSection = lastSection.split('.')[0];
    }
    // Check if the remaining string is a valid hex string
    if (HEX_STRING_REGEX.test(lastSection)) {
        return lastSection;
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map