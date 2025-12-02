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
exports.ProjectManagement = void 0;
const error_1 = require("../utils/error");
const utils = require("../utils/index");
const validator = require("../utils/validator");
const android_app_1 = require("./android-app");
const ios_app_1 = require("./ios-app");
const project_management_api_request_internal_1 = require("./project-management-api-request-internal");
const app_metadata_1 = require("./app-metadata");
/**
 * The Firebase ProjectManagement service interface.
 */
class ProjectManagement {
    /**
     * @param app - The app for this ProjectManagement service.
     * @constructor
     * @internal
     */
    constructor(app) {
        this.app = app;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new error_1.FirebaseProjectManagementError('invalid-argument', 'First argument passed to admin.projectManagement() must be a valid Firebase app '
                + 'instance.');
        }
        this.requestHandler = new project_management_api_request_internal_1.ProjectManagementRequestHandler(app);
    }
    /**
     * Lists up to 100 Firebase Android apps associated with this Firebase project.
     *
     * @returns The list of Android apps.
     */
    listAndroidApps() {
        return this.listPlatformApps('android', 'listAndroidApps()');
    }
    /**
     * Lists up to 100 Firebase iOS apps associated with this Firebase project.
     *
     * @returns The list of iOS apps.
     */
    listIosApps() {
        return this.listPlatformApps('ios', 'listIosApps()');
    }
    /**
     * Creates an `AndroidApp` object, referencing the specified Android app within
     * this Firebase project.
     *
     * This method does not perform an RPC.
     *
     * @param appId - The `appId` of the Android app to reference.
     *
     * @returns An `AndroidApp` object that references the specified Firebase Android app.
     */
    androidApp(appId) {
        return new android_app_1.AndroidApp(appId, this.requestHandler);
    }
    /**
     * Creates an `iOSApp` object, referencing the specified iOS app within
     * this Firebase project.
     *
     * This method does not perform an RPC.
     *
     * @param appId - The `appId` of the iOS app to reference.
     *
     * @returns An `iOSApp` object that references the specified Firebase iOS app.
     */
    iosApp(appId) {
        return new ios_app_1.IosApp(appId, this.requestHandler);
    }
    /**
     * Creates a `ShaCertificate` object.
     *
     * This method does not perform an RPC.
     *
     * @param shaHash - The SHA-1 or SHA-256 hash for this certificate.
     *
     * @returns A `ShaCertificate` object contains the specified SHA hash.
     */
    shaCertificate(shaHash) {
        return new android_app_1.ShaCertificate(shaHash);
    }
    /**
     * Creates a new Firebase Android app associated with this Firebase project.
     *
     * @param packageName - The canonical package name of the Android App,
     *     as would appear in the Google Play Developer Console.
     * @param displayName - An optional user-assigned display name for this
     *     new app.
     *
     * @returns A promise that resolves to the newly created Android app.
     */
    createAndroidApp(packageName, displayName) {
        return this.getResourceName()
            .then((resourceName) => {
            return this.requestHandler.createAndroidApp(resourceName, packageName, displayName);
        })
            .then((responseData) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, 'createAndroidApp()\'s responseData must be a non-null object.');
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(responseData.appId), responseData, '"responseData.appId" field must be present in createAndroidApp()\'s response data.');
            return new android_app_1.AndroidApp(responseData.appId, this.requestHandler);
        });
    }
    /**
     * Creates a new Firebase iOS app associated with this Firebase project.
     *
     * @param bundleId - The iOS app bundle ID to use for this new app.
     * @param displayName - An optional user-assigned display name for this
     *     new app.
     *
     * @returns A promise that resolves to the newly created iOS app.
     */
    createIosApp(bundleId, displayName) {
        return this.getResourceName()
            .then((resourceName) => {
            return this.requestHandler.createIosApp(resourceName, bundleId, displayName);
        })
            .then((responseData) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, 'createIosApp()\'s responseData must be a non-null object.');
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(responseData.appId), responseData, '"responseData.appId" field must be present in createIosApp()\'s response data.');
            return new ios_app_1.IosApp(responseData.appId, this.requestHandler);
        });
    }
    /**
     * Lists up to 100 Firebase apps associated with this Firebase project.
     *
     * @returns A promise that resolves to the metadata list of the apps.
     */
    listAppMetadata() {
        return this.getResourceName()
            .then((resourceName) => {
            return this.requestHandler.listAppMetadata(resourceName);
        })
            .then((responseData) => {
            return this.getProjectId()
                .then((projectId) => {
                return this.transformResponseToAppMetadata(responseData, projectId);
            });
        });
    }
    /**
     * Update the display name of this Firebase project.
     *
     * @param newDisplayName - The new display name to be updated.
     *
     * @returns A promise that resolves when the project display name has been updated.
     */
    setDisplayName(newDisplayName) {
        return this.getResourceName()
            .then((resourceName) => {
            return this.requestHandler.setDisplayName(resourceName, newDisplayName);
        });
    }
    transformResponseToAppMetadata(responseData, projectId) {
        this.assertListAppsResponseData(responseData, 'listAppMetadata()');
        if (!responseData.apps) {
            return [];
        }
        return responseData.apps.map((appJson) => {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(appJson.appId), responseData, '"apps[].appId" field must be present in the listAppMetadata() response data.');
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(appJson.platform), responseData, '"apps[].platform" field must be present in the listAppMetadata() response data.');
            const metadata = {
                appId: appJson.appId,
                platform: app_metadata_1.AppPlatform[appJson.platform] || app_metadata_1.AppPlatform.PLATFORM_UNKNOWN,
                projectId,
                resourceName: appJson.name,
            };
            if (appJson.displayName) {
                metadata.displayName = appJson.displayName;
            }
            return metadata;
        });
    }
    getResourceName() {
        return this.getProjectId()
            .then((projectId) => {
            return `projects/${projectId}`;
        });
    }
    getProjectId() {
        if (this.projectId) {
            return Promise.resolve(this.projectId);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            // Assert that a specific project ID was provided within the app.
            if (!validator.isNonEmptyString(projectId)) {
                throw new error_1.FirebaseProjectManagementError('invalid-project-id', 'Failed to determine project ID. Initialize the SDK with service account credentials, or '
                    + 'set project ID as an app option. Alternatively, set the GOOGLE_CLOUD_PROJECT '
                    + 'environment variable.');
            }
            this.projectId = projectId;
            return this.projectId;
        });
    }
    /**
     * Lists up to 100 Firebase apps for a specified platform, associated with this Firebase project.
     */
    listPlatformApps(platform, callerName) {
        return this.getResourceName()
            .then((resourceName) => {
            return (platform === 'android') ?
                this.requestHandler.listAndroidApps(resourceName)
                : this.requestHandler.listIosApps(resourceName);
        })
            .then((responseData) => {
            this.assertListAppsResponseData(responseData, callerName);
            if (!responseData.apps) {
                return [];
            }
            return responseData.apps.map((appJson) => {
                (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonEmptyString(appJson.appId), responseData, `"apps[].appId" field must be present in the ${callerName} response data.`);
                if (platform === 'android') {
                    return new android_app_1.AndroidApp(appJson.appId, this.requestHandler);
                }
                else {
                    return new ios_app_1.IosApp(appJson.appId, this.requestHandler);
                }
            });
        });
    }
    assertListAppsResponseData(responseData, callerName) {
        (0, project_management_api_request_internal_1.assertServerResponse)(validator.isNonNullObject(responseData), responseData, `${callerName}'s responseData must be a non-null object.`);
        if (responseData.apps) {
            (0, project_management_api_request_internal_1.assertServerResponse)(validator.isArray(responseData.apps), responseData, `"apps" field must be present in the ${callerName} response data.`);
        }
    }
}
exports.ProjectManagement = ProjectManagement;
