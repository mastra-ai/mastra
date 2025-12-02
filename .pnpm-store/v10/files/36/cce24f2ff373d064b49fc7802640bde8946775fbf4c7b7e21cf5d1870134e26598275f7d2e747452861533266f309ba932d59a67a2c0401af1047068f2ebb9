/*! firebase-admin v13.5.0 */
"use strict";
/*!
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
exports.InstallationsClientErrorCode = exports.FirebaseInstallationsError = exports.Installations = void 0;
exports.getInstallations = getInstallations;
/**
 * Firebase Instance ID service.
 *
 * @packageDocumentation
 */
const index_1 = require("../app/index");
const installations_1 = require("./installations");
Object.defineProperty(exports, "Installations", { enumerable: true, get: function () { return installations_1.Installations; } });
/**
  * Gets the {@link Installations} service for the default app or a given app.
  *
  * `getInstallations()` can be called with no arguments to access the default
  * app's `Installations` service or as `getInstallations(app)` to access the
  * `Installations` service associated with a specific app.
  *
  * @example
  * ```javascript
  * // Get the Installations service for the default app
  * const defaultInstallations = getInstallations();
  * ```
  *
  * @example
  * ```javascript
  * // Get the Installations service for a given app
  * const otherInstallations = getInstallations(otherApp);
  *```
  *
  * @param app - Optional app whose `Installations` service to
  *   return. If not provided, the default `Installations` service will be
  *   returned.
  *
  * @returns The default `Installations` service if
  *   no app is provided or the `Installations` service associated with the
  *   provided app.
  */
function getInstallations(app) {
    if (typeof app === 'undefined') {
        app = (0, index_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('installations', (app) => new installations_1.Installations(app));
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseInstallationsError", { enumerable: true, get: function () { return error_1.FirebaseInstallationsError; } });
Object.defineProperty(exports, "InstallationsClientErrorCode", { enumerable: true, get: function () { return error_1.InstallationsClientErrorCode; } });
