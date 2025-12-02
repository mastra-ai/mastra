/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2021 Google Inc.
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
exports.AppCheck = void 0;
exports.getAppCheck = getAppCheck;
/**
 * Firebase App Check.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const app_check_1 = require("./app-check");
var app_check_2 = require("./app-check");
Object.defineProperty(exports, "AppCheck", { enumerable: true, get: function () { return app_check_2.AppCheck; } });
/**
 * Gets the {@link AppCheck} service for the default app or a given app.
 *
 * `getAppCheck()` can be called with no arguments to access the default
 * app's `AppCheck` service or as `getAppCheck(app)` to access the
 * `AppCheck` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the `AppCheck` service for the default app
 * const defaultAppCheck = getAppCheck();
 * ```
 *
 * @example
 * ```javascript
 * // Get the `AppCheck` service for a given app
 * const otherAppCheck = getAppCheck(otherApp);
 * ```
 *
 * @param app - Optional app for which to return the `AppCheck` service.
 *   If not provided, the default `AppCheck` service is returned.
 *
 * @returns The default `AppCheck` service if no
 *   app is provided, or the `AppCheck` service associated with the provided
 *   app.
 */
function getAppCheck(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('appCheck', (app) => new app_check_1.AppCheck(app));
}
