/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2022 Google Inc.
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
exports.Channel = exports.Eventarc = void 0;
exports.getEventarc = getEventarc;
/**
 * Firebase Eventarc.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const eventarc_1 = require("./eventarc");
var eventarc_2 = require("./eventarc");
Object.defineProperty(exports, "Eventarc", { enumerable: true, get: function () { return eventarc_2.Eventarc; } });
Object.defineProperty(exports, "Channel", { enumerable: true, get: function () { return eventarc_2.Channel; } });
/**
 * Gets the {@link Eventarc} service for the default app or a given app.
 *
 * `getEventarc()` can be called with no arguments to access the default
 * app's `Eventarc` service or as `getEventarc(app)` to access the
 * `Eventarc` service associated with specific app.
 *
 * @example
 * ```javascript
 * // Get the Eventarc service for the default app
 * const defaultEventarc = getEventarc();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Eventarc service for a given app
 * const otherEventarc = getEventarc(otherApp);
 * ```
 *
 * @param app - Optional app whose `Eventarc` service will be returned.
 *   If not provided, the default `Eventarc` service will be returned.
 *
 * @returns The default `Eventarc` service if no
 *   app is provided or the `Eventarc` service associated with the provided
 *   app.
 */
function getEventarc(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('eventarc', (app) => new eventarc_1.Eventarc(app));
}
