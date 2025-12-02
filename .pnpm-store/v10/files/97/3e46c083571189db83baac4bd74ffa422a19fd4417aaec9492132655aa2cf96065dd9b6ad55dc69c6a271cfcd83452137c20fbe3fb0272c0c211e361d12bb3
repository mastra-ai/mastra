/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSdkVersion = getSdkVersion;
exports.getMetricsHeader = getMetricsHeader;
exports.renameProperties = renameProperties;
exports.addReadonlyGetter = addReadonlyGetter;
exports.getExplicitProjectId = getExplicitProjectId;
exports.findProjectId = findProjectId;
exports.getExplicitServiceAccountEmail = getExplicitServiceAccountEmail;
exports.findServiceAccountEmail = findServiceAccountEmail;
exports.toWebSafeBase64 = toWebSafeBase64;
exports.formatString = formatString;
exports.generateUpdateMask = generateUpdateMask;
exports.transformMillisecondsToSecondsString = transformMillisecondsToSecondsString;
exports.parseResourceName = parseResourceName;
const credential_internal_1 = require("../app/credential-internal");
const validator = require("./validator");
let sdkVersion;
// TODO: Move to firebase-admin/app as an internal member.
function getSdkVersion() {
    if (!sdkVersion) {
        const { version } = require('../../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires
        sdkVersion = version;
    }
    return sdkVersion;
}
function getMetricsHeader() {
    return `gl-node/${process.versions.node} fire-admin/${getSdkVersion()}`;
}
/**
 * Renames properties on an object given a mapping from old to new property names.
 *
 * For example, this can be used to map underscore_cased properties to camelCase.
 *
 * @param obj - The object whose properties to rename.
 * @param keyMap - The mapping from old to new property names.
 */
function renameProperties(obj, keyMap) {
    Object.keys(keyMap).forEach((oldKey) => {
        if (oldKey in obj) {
            const newKey = keyMap[oldKey];
            // The old key's value takes precedence over the new key's value.
            obj[newKey] = obj[oldKey];
            delete obj[oldKey];
        }
    });
}
/**
 * Defines a new read-only property directly on an object and returns the object.
 *
 * @param obj - The object on which to define the property.
 * @param prop - The name of the property to be defined or modified.
 * @param value - The value associated with the property.
 */
function addReadonlyGetter(obj, prop, value) {
    Object.defineProperty(obj, prop, {
        value,
        // Make this property read-only.
        writable: false,
        // Include this property during enumeration of obj's properties.
        enumerable: true,
    });
}
/**
 * Returns the Google Cloud project ID associated with a Firebase app, if it's explicitly
 * specified in either the Firebase app options, credentials or the local environment.
 * Otherwise returns null.
 *
 * @param app - A Firebase app to get the project ID from.
 *
 * @returns A project ID string or null.
 */
function getExplicitProjectId(app) {
    const options = app.options;
    if (validator.isNonEmptyString(options.projectId)) {
        return options.projectId;
    }
    const credential = app.options.credential;
    if (credential instanceof credential_internal_1.ServiceAccountCredential) {
        return credential.projectId;
    }
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    if (validator.isNonEmptyString(projectId)) {
        return projectId;
    }
    return null;
}
/**
 * Determines the Google Cloud project ID associated with a Firebase app. This method
 * first checks if a project ID is explicitly specified in either the Firebase app options,
 * credentials or the local environment in that order. If no explicit project ID is
 * configured, but the SDK has been initialized with ComputeEngineCredentials, this
 * method attempts to discover the project ID from the local metadata service.
 *
 * @param app - A Firebase app to get the project ID from.
 *
 * @returns A project ID string or null.
 */
function findProjectId(app) {
    const projectId = getExplicitProjectId(app);
    if (projectId) {
        return Promise.resolve(projectId);
    }
    const credential = app.options.credential;
    if (credential instanceof credential_internal_1.ApplicationDefaultCredential) {
        return credential.getProjectId();
    }
    return Promise.resolve(null);
}
/**
 * Returns the service account email associated with a Firebase app, if it's explicitly
 * specified in either the Firebase app options, credentials or the local environment.
 * Otherwise returns null.
 *
 * @param app - A Firebase app to get the service account email from.
 *
 * @returns A service account email string or null.
 */
function getExplicitServiceAccountEmail(app) {
    const options = app.options;
    if (validator.isNonEmptyString(options.serviceAccountId)) {
        return options.serviceAccountId;
    }
    const credential = app.options.credential;
    if (credential instanceof credential_internal_1.ServiceAccountCredential) {
        return credential.clientEmail;
    }
    return null;
}
/**
 * Determines the service account email associated with a Firebase app. This method first
 * checks if a service account email is explicitly specified in either the Firebase app options,
 * credentials or the local environment in that order. If no explicit service account email is
 * configured, but the SDK has been initialized with ComputeEngineCredentials, this
 * method attempts to discover the service account email from the local metadata service.
 *
 * @param app - A Firebase app to get the service account email from.
 *
 * @returns A service account email ID string or null.
 */
function findServiceAccountEmail(app) {
    const accountId = getExplicitServiceAccountEmail(app);
    if (accountId) {
        return Promise.resolve(accountId);
    }
    const credential = app.options.credential;
    if (credential instanceof credential_internal_1.ApplicationDefaultCredential) {
        return credential.getServiceAccountEmail();
    }
    return Promise.resolve(null);
}
/**
 * Encodes data using web-safe-base64.
 *
 * @param data - The raw data byte input.
 * @returns The base64-encoded result.
 */
function toWebSafeBase64(data) {
    return data.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
}
/**
 * Formats a string of form 'project/{projectId}/{api}' and replaces
 * with corresponding arguments {projectId: '1234', api: 'resource'}
 * and returns output: 'project/1234/resource'.
 *
 * @param str - The original string where the param need to be
 *     replaced.
 * @param params - The optional parameters to replace in the
 *     string.
 * @returns The resulting formatted string.
 */
function formatString(str, params) {
    let formatted = str;
    Object.keys(params || {}).forEach((key) => {
        formatted = formatted.replace(new RegExp('{' + key + '}', 'g'), params[key]);
    });
    return formatted;
}
/**
 * Generates the update mask for the provided object.
 * Note this will ignore the last key with value undefined.
 *
 * @param obj - The object to generate the update mask for.
 * @param terminalPaths - The optional map of keys for maximum paths to traverse.
 *      Nested objects beyond that path will be ignored. This is useful for
 *      keys with variable object values.
 * @param root - The path so far.
 * @returns The computed update mask list.
 */
function generateUpdateMask(obj, terminalPaths = [], root = '') {
    const updateMask = [];
    if (!validator.isNonNullObject(obj)) {
        return updateMask;
    }
    for (const key in obj) {
        if (typeof obj[key] !== 'undefined') {
            const nextPath = root ? `${root}.${key}` : key;
            // We hit maximum path.
            // Consider switching to Set<string> if the list grows too large.
            if (terminalPaths.indexOf(nextPath) !== -1) {
                // Add key and stop traversing this branch.
                updateMask.push(key);
            }
            else {
                const maskList = generateUpdateMask(obj[key], terminalPaths, nextPath);
                if (maskList.length > 0) {
                    maskList.forEach((mask) => {
                        updateMask.push(`${key}.${mask}`);
                    });
                }
                else {
                    updateMask.push(key);
                }
            }
        }
    }
    return updateMask;
}
/**
 * Transforms milliseconds to a protobuf Duration type string.
 * Returns the duration in seconds with up to nine fractional
 * digits, terminated by 's'. Example: "3 seconds 0 nano seconds as 3s,
 * 3 seconds 1 nano seconds as 3.000000001s".
 *
 * @param milliseconds - The duration in milliseconds.
 * @returns The resulting formatted string in seconds with up to nine fractional
 * digits, terminated by 's'.
 */
function transformMillisecondsToSecondsString(milliseconds) {
    let duration;
    const seconds = Math.floor(milliseconds / 1000);
    const nanos = Math.floor((milliseconds - seconds * 1000) * 1000000);
    if (nanos > 0) {
        let nanoString = nanos.toString();
        while (nanoString.length < 9) {
            nanoString = '0' + nanoString;
        }
        duration = `${seconds}.${nanoString}s`;
    }
    else {
        duration = `${seconds}s`;
    }
    return duration;
}
/**
 * Parses the top level resources of a given resource name.
 * Supports both full and partial resources names, example:
 * `locations/{location}/functions/{functionName}`,
 * `projects/{project}/locations/{location}/functions/{functionName}`, or {functionName}
 * Does not support deeply nested resource names.
 *
 * @param resourceName - The resource name string.
 * @param resourceIdKey - The key of the resource name to be parsed.
 * @returns A parsed resource name object.
 */
function parseResourceName(resourceName, resourceIdKey) {
    if (!resourceName.includes('/')) {
        return { resourceId: resourceName };
    }
    const CHANNEL_NAME_REGEX = new RegExp(`^(projects/([^/]+)/)?locations/([^/]+)/${resourceIdKey}/([^/]+)$`);
    const match = CHANNEL_NAME_REGEX.exec(resourceName);
    if (match === null) {
        throw new Error('Invalid resource name format.');
    }
    const projectId = match[2];
    const locationId = match[3];
    const resourceId = match[4];
    return { projectId, locationId, resourceId };
}
