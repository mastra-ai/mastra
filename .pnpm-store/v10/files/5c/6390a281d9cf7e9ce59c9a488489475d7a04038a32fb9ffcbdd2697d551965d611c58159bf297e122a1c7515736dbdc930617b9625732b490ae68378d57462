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
exports.RemoteConfigFetchResponse = exports.RemoteConfig = exports.PercentConditionOperator = exports.CustomSignalOperator = void 0;
exports.getRemoteConfig = getRemoteConfig;
/**
 * Firebase Remote Config.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const remote_config_1 = require("./remote-config");
var remote_config_api_1 = require("./remote-config-api");
Object.defineProperty(exports, "CustomSignalOperator", { enumerable: true, get: function () { return remote_config_api_1.CustomSignalOperator; } });
Object.defineProperty(exports, "PercentConditionOperator", { enumerable: true, get: function () { return remote_config_api_1.PercentConditionOperator; } });
var remote_config_2 = require("./remote-config");
Object.defineProperty(exports, "RemoteConfig", { enumerable: true, get: function () { return remote_config_2.RemoteConfig; } });
Object.defineProperty(exports, "RemoteConfigFetchResponse", { enumerable: true, get: function () { return remote_config_2.RemoteConfigFetchResponse; } });
/**
 * Gets the {@link RemoteConfig} service for the default app or a given app.
 *
 * `getRemoteConfig()` can be called with no arguments to access the default
 * app's `RemoteConfig` service or as `getRemoteConfig(app)` to access the
 * `RemoteConfig` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the `RemoteConfig` service for the default app
 * const defaultRemoteConfig = getRemoteConfig();
 * ```
 *
 * @example
 * ```javascript
 * // Get the `RemoteConfig` service for a given app
 * const otherRemoteConfig = getRemoteConfig(otherApp);
 * ```
 *
 * @param app - Optional app for which to return the `RemoteConfig` service.
 *   If not provided, the default `RemoteConfig` service is returned.
 *
 * @returns The default `RemoteConfig` service if no
 *   app is provided, or the `RemoteConfig` service associated with the provided
 *   app.
 */
function getRemoteConfig(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('remoteConfig', (app) => new remote_config_1.RemoteConfig(app));
}
