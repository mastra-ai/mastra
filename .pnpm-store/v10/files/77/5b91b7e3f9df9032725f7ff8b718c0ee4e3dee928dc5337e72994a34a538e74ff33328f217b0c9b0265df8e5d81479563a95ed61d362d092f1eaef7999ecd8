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
exports.AuthClientErrorCode = exports.FirebaseAuthError = exports.UserRecord = exports.UserMetadata = exports.UserInfo = exports.PhoneMultiFactorInfo = exports.MultiFactorSettings = exports.MultiFactorInfo = exports.ProjectConfigManager = exports.ProjectConfig = exports.TenantManager = exports.TenantAwareAuth = exports.Tenant = exports.BaseAuth = exports.Auth = void 0;
exports.getAuth = getAuth;
/**
 * Firebase Authentication.
 *
 * @packageDocumentation
 */
const index_1 = require("../app/index");
const auth_1 = require("./auth");
/**
 * Gets the {@link Auth} service for the default app or a
 * given app.
 *
 * `getAuth()` can be called with no arguments to access the default app's
 * {@link Auth} service or as `getAuth(app)` to access the
 * {@link Auth} service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Auth service for the default app
 * const defaultAuth = getAuth();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Auth service for a given app
 * const otherAuth = getAuth(otherApp);
 * ```
 *
 */
function getAuth(app) {
    if (typeof app === 'undefined') {
        app = (0, index_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('auth', (app) => new auth_1.Auth(app));
}
var auth_2 = require("./auth");
Object.defineProperty(exports, "Auth", { enumerable: true, get: function () { return auth_2.Auth; } });
var base_auth_1 = require("./base-auth");
Object.defineProperty(exports, "BaseAuth", { enumerable: true, get: function () { return base_auth_1.BaseAuth; } });
var tenant_1 = require("./tenant");
Object.defineProperty(exports, "Tenant", { enumerable: true, get: function () { return tenant_1.Tenant; } });
var tenant_manager_1 = require("./tenant-manager");
Object.defineProperty(exports, "TenantAwareAuth", { enumerable: true, get: function () { return tenant_manager_1.TenantAwareAuth; } });
Object.defineProperty(exports, "TenantManager", { enumerable: true, get: function () { return tenant_manager_1.TenantManager; } });
var project_config_1 = require("./project-config");
Object.defineProperty(exports, "ProjectConfig", { enumerable: true, get: function () { return project_config_1.ProjectConfig; } });
var project_config_manager_1 = require("./project-config-manager");
Object.defineProperty(exports, "ProjectConfigManager", { enumerable: true, get: function () { return project_config_manager_1.ProjectConfigManager; } });
var user_record_1 = require("./user-record");
Object.defineProperty(exports, "MultiFactorInfo", { enumerable: true, get: function () { return user_record_1.MultiFactorInfo; } });
Object.defineProperty(exports, "MultiFactorSettings", { enumerable: true, get: function () { return user_record_1.MultiFactorSettings; } });
Object.defineProperty(exports, "PhoneMultiFactorInfo", { enumerable: true, get: function () { return user_record_1.PhoneMultiFactorInfo; } });
Object.defineProperty(exports, "UserInfo", { enumerable: true, get: function () { return user_record_1.UserInfo; } });
Object.defineProperty(exports, "UserMetadata", { enumerable: true, get: function () { return user_record_1.UserMetadata; } });
Object.defineProperty(exports, "UserRecord", { enumerable: true, get: function () { return user_record_1.UserRecord; } });
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseAuthError", { enumerable: true, get: function () { return error_1.FirebaseAuthError; } });
Object.defineProperty(exports, "AuthClientErrorCode", { enumerable: true, get: function () { return error_1.AuthClientErrorCode; } });
