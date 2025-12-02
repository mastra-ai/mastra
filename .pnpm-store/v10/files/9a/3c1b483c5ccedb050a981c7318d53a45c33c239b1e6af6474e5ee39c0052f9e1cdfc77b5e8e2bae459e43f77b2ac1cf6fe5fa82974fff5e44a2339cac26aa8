/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2018 Google Inc.
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
exports.ShaCertificate = exports.AndroidApp = void 0;
const error_1 = require("../utils/error");
const validator = require("../utils/validator");
const project_management_api_request_internal_1 = require("./project-management-api-request-internal");
const app_metadata_1 = require("./app-metadata");
/**
 * A reference to a Firebase Android app.
 *
 * Do not call this constructor directly. Instead, use {@link ProjectManagement.androidApp}.
 */
class AndroidApp {
    /**
     * @internal
     */
    constructor(appId, requestHandler) {
        this.appId = appId;
        this.requestHandler = requestHandler;
        if (!validator.isNonEmptyString(appId)) {
            throw new error_1.FirebaseProjectManagementError('invalid-argument', 'appId must be a non-empty string.');
        }
        this.resourceName = `projects/-/androidApps/${appId}`;
    }
    /**
     * Retrieves metadata about this Android app.
     *
     * @returns A promise that resolves to the retrieved metadata about this Android app.
     */
    getMetadata() {
        return this.requestHandler.getResource(this.resourceName)
            .then((responseData) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, 'getMetadata()\'s responseData must be a non-null object.');
            const requiredFieldsList = ['name', 'appId', 'projectId', 'packageName'];
            requiredFieldsList.forEach((requiredField) => {
                (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(responseData[requiredField]), responseData, `getMetadata()'s responseData.${requiredField} must be a non-empty string.`);
            });
            const metadata = {
                platform: app_metadata_1.AppPlatform.ANDROID,
                resourceName: responseData.name,
                appId: responseData.appId,
                displayName: responseData.displayName || null,
                projectId: responseData.projectId,
                packageName: responseData.packageName,
            };
            return metadata;
        });
    }
    /**
     * Sets the optional user-assigned display name of the app.
     *
     * @param newDisplayName - The new display name to set.
     *
     * @returns A promise that resolves when the display name has been set.
     */
    setDisplayName(newDisplayName) {
        return this.requestHandler.setDisplayName(this.resourceName, newDisplayName);
    }
    /**
     * Gets the list of SHA certificates associated with this Android app in Firebase.
     *
     * @returns The list of SHA-1 and SHA-256 certificates associated with this Android app in
     *     Firebase.
     */
    getShaCertificates() {
        return this.requestHandler.getAndroidShaCertificates(this.resourceName)
            .then((responseData) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, 'getShaCertificates()\'s responseData must be a non-null object.');
            if (!responseData.certificates) {
                return [];
            }
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isArray(responseData.certificates), responseData, '"certificates" field must be present in the getShaCertificates() response data.');
            const requiredFieldsList = ['name', 'shaHash'];
            return responseData.certificates.map((certificateJson) => {
                requiredFieldsList.forEach((requiredField) => {
                    (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(certificateJson[requiredField]), responseData, `getShaCertificates()'s responseData.certificates[].${requiredField} must be a `
                        + 'non-empty string.');
                });
                return new ShaCertificate(certificateJson.shaHash, certificateJson.name);
            });
        });
    }
    /**
     * Adds the given SHA certificate to this Android app.
     *
     * @param certificateToAdd - The SHA certificate to add.
     *
     * @returns A promise that resolves when the given certificate
     *     has been added to the Android app.
     */
    addShaCertificate(certificateToAdd) {
        return this.requestHandler.addAndroidShaCertificate(this.resourceName, certificateToAdd);
    }
    /**
     * Deletes the specified SHA certificate from this Android app.
     *
     * @param certificateToDelete - The SHA certificate to delete.
     *
     * @returns A promise that resolves when the specified
     *     certificate has been removed from the Android app.
     */
    deleteShaCertificate(certificateToDelete) {
        if (!certificateToDelete.resourceName) {
            throw new error_1.FirebaseProjectManagementError('invalid-argument', 'Specified certificate does not include a resourceName. (Use AndroidApp.getShaCertificates() to retrieve ' +
                'certificates with a resourceName.');
        }
        return this.requestHandler.deleteResource(certificateToDelete.resourceName);
    }
    /**
     * Gets the configuration artifact associated with this app.
     *
     * @returns A promise that resolves to the Android app's
     *     Firebase config file, in UTF-8 string format. This string is typically
     *     intended to be written to a JSON file that gets shipped with your Android
     *     app.
     */
    getConfig() {
        return this.requestHandler.getConfig(this.resourceName)
            .then((responseData) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, 'getConfig()\'s responseData must be a non-null object.');
            const base64ConfigFileContents = responseData.configFileContents;
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isBase64String(base64ConfigFileContents), responseData, 'getConfig()\'s responseData.configFileContents must be a base64 string.');
            return Buffer.from(base64ConfigFileContents, 'base64').toString('utf8');
        });
    }
}
exports.AndroidApp = AndroidApp;
/**
 * A SHA-1 or SHA-256 certificate.
 *
 * Do not call this constructor directly. Instead, use
 * [`projectManagement.shaCertificate()`](projectManagement.ProjectManagement#shaCertificate).
 */
class ShaCertificate {
    /**
     * Creates a ShaCertificate using the given hash. The ShaCertificate's type (eg. 'sha256') is
     * automatically determined from the hash itself.
     *
     * @param shaHash - The sha256 or sha1 hash for this certificate.
     * @example
     * ```javascript
     * var shaHash = shaCertificate.shaHash;
     * ```
     * @param resourceName - The Firebase resource name for this certificate. This does not need to be
     *     set when creating a new certificate.
     * @example
     * ```javascript
     * var resourceName = shaCertificate.resourceName;
     * ```
     *
     * @internal
     */
    constructor(shaHash, resourceName) {
        this.shaHash = shaHash;
        this.resourceName = resourceName;
        if (/^[a-fA-F0-9]{40}$/.test(shaHash)) {
            this.certType = 'sha1';
        }
        else if (/^[a-fA-F0-9]{64}$/.test(shaHash)) {
            this.certType = 'sha256';
        }
        else {
            throw new error_1.FirebaseProjectManagementError('invalid-argument', 'shaHash must be either a sha256 hash or a sha1 hash.');
        }
    }
}
exports.ShaCertificate = ShaCertificate;
