/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2020 Google Inc.
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
exports.FirebaseProjectManagementError = exports.IosApp = exports.ShaCertificate = exports.AndroidApp = exports.ProjectManagement = exports.AppPlatform = void 0;
exports.getProjectManagement = getProjectManagement;
/**
 * Firebase project management.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const project_management_1 = require("./project-management");
var app_metadata_1 = require("./app-metadata");
Object.defineProperty(exports, "AppPlatform", { enumerable: true, get: function () { return app_metadata_1.AppPlatform; } });
var project_management_2 = require("./project-management");
Object.defineProperty(exports, "ProjectManagement", { enumerable: true, get: function () { return project_management_2.ProjectManagement; } });
var android_app_1 = require("./android-app");
Object.defineProperty(exports, "AndroidApp", { enumerable: true, get: function () { return android_app_1.AndroidApp; } });
Object.defineProperty(exports, "ShaCertificate", { enumerable: true, get: function () { return android_app_1.ShaCertificate; } });
var ios_app_1 = require("./ios-app");
Object.defineProperty(exports, "IosApp", { enumerable: true, get: function () { return ios_app_1.IosApp; } });
/**
 * Gets the {@link ProjectManagement} service for the default app or a given app.
 *
 * `getProjectManagement()` can be called with no arguments to access the
 * default app's `ProjectManagement` service, or as `getProjectManagement(app)` to access
 * the `ProjectManagement` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the ProjectManagement service for the default app
 * const defaultProjectManagement = getProjectManagement();
 * ```
 *
 * @example
 * ```javascript
 * // Get the ProjectManagement service for a given app
 * const otherProjectManagement = getProjectManagement(otherApp);
 * ```
 *
 * @param app - Optional app whose `ProjectManagement` service
 *     to return. If not provided, the default `ProjectManagement` service will
 *     be returned. *
 * @returns The default `ProjectManagement` service if no app is provided or the
 *   `ProjectManagement` service associated with the provided app.
 */
function getProjectManagement(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('projectManagement', (app) => new project_management_1.ProjectManagement(app));
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseProjectManagementError", { enumerable: true, get: function () { return error_1.FirebaseProjectManagementError; } });
