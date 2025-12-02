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
exports.InstanceIdClientErrorCode = exports.FirebaseInstanceIdError = exports.InstanceId = void 0;
exports.getInstanceId = getInstanceId;
/**
 * Firebase Instance ID service.
 *
 * @packageDocumentation
 */
const index_1 = require("../app/index");
const instance_id_1 = require("./instance-id");
Object.defineProperty(exports, "InstanceId", { enumerable: true, get: function () { return instance_id_1.InstanceId; } });
/**
 * Gets the {@link InstanceId} service for the default app or a given app.
 *
 * This API is deprecated. Developers are advised to use the
 * {@link firebase-admin.installations#getInstallations}
 * API to delete their instance IDs and Firebase installation IDs.
 *
 * `getInstanceId()` can be called with no arguments to access the default
 * app's `InstanceId` service or as `getInstanceId(app)` to access the
 * `InstanceId` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Instance ID service for the default app
 * const defaultInstanceId = getInstanceId();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Instance ID service for a given app
 * const otherInstanceId = getInstanceId(otherApp);
 *```
 *
 * This API is deprecated. Developers are advised to use the `admin.installations()`
 * API to delete their instance IDs and Firebase installation IDs.
 *
 * @param app - Optional app whose `InstanceId` service to
 *   return. If not provided, the default `InstanceId` service will be
 *   returned.
 *
 * @returns The default `InstanceId` service if
 *   no app is provided or the `InstanceId` service associated with the
 *   provided app.
 *
 * @deprecated Use {@link firebase-admin.installations#getInstallations} instead.
 */
function getInstanceId(app) {
    if (typeof app === 'undefined') {
        app = (0, index_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('instanceId', (app) => new instance_id_1.InstanceId(app));
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseInstanceIdError", { enumerable: true, get: function () { return error_1.FirebaseInstanceIdError; } });
Object.defineProperty(exports, "InstanceIdClientErrorCode", { enumerable: true, get: function () { return error_1.InstanceIdClientErrorCode; } });
