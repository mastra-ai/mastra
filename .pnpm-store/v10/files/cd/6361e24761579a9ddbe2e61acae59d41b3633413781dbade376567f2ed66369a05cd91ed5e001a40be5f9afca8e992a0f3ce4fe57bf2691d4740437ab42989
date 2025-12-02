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
exports.MessagingClientErrorCode = exports.FirebaseMessagingError = exports.Messaging = void 0;
exports.getMessaging = getMessaging;
/**
 * Firebase Cloud Messaging (FCM).
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const messaging_1 = require("./messaging");
var messaging_2 = require("./messaging");
Object.defineProperty(exports, "Messaging", { enumerable: true, get: function () { return messaging_2.Messaging; } });
/**
 * Gets the {@link Messaging} service for the default app or a given app.
 *
 * `admin.messaging()` can be called with no arguments to access the default
 * app's `Messaging` service or as `admin.messaging(app)` to access the
 * `Messaging` service associated with aspecific app.
 *
 * @example
 * ```javascript
 * // Get the Messaging service for the default app
 * const defaultMessaging = getMessaging();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Messaging service for a given app
 * const otherMessaging = getMessaging(otherApp);
 * ```
 *
 * @param app - Optional app whose `Messaging` service to
 *   return. If not provided, the default `Messaging` service will be returned.
 *
 * @returns The default `Messaging` service if no
 *   app is provided or the `Messaging` service associated with the provided
 *   app.
 */
function getMessaging(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('messaging', (app) => new messaging_1.Messaging(app));
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseMessagingError", { enumerable: true, get: function () { return error_1.FirebaseMessagingError; } });
Object.defineProperty(exports, "MessagingClientErrorCode", { enumerable: true, get: function () { return error_1.MessagingClientErrorCode; } });
