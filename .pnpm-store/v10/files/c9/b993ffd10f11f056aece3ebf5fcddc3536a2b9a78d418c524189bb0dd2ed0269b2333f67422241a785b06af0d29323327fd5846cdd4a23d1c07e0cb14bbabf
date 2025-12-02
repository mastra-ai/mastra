/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2024 Google Inc.
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
exports.DataConnect = void 0;
exports.getDataConnect = getDataConnect;
/**
 * Firebase Data Connect service.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const data_connect_1 = require("./data-connect");
var data_connect_2 = require("./data-connect");
Object.defineProperty(exports, "DataConnect", { enumerable: true, get: function () { return data_connect_2.DataConnect; } });
/**
 * Gets the {@link DataConnect} service with the provided connector configuration
 * for the default app or a given app.
 *
 * `getDataConnect(connectorConfig)` can be called with no app argument to access the default
 * app's `DataConnect` service or as `getDataConnect(connectorConfig, app)` to access the
 * `DataConnect` service associated with a specific app.
 *
 * @example
 * ```javascript
 * const connectorConfig: ConnectorConfig = {
 *  location: 'us-west2',
 *  serviceId: 'my-service',
 * };
 *
 * // Get the `DataConnect` service for the default app
 * const defaultDataConnect = getDataConnect(connectorConfig);
 * ```
 *
 * @example
 * ```javascript
 * // Get the `DataConnect` service for a given app
 * const otherDataConnect = getDataConnect(connectorConfig, otherApp);
 * ```
 *
 * @param connectorConfig - Connector configuration for the `DataConnect` service.
 *
 * @param app - Optional app for which to return the `DataConnect` service.
 *   If not provided, the default `DataConnect` service is returned.
 *
 * @returns The default `DataConnect` service with the provided connector configuration
 *  if no app is provided, or the `DataConnect` service associated with the provided app.
 */
function getDataConnect(connectorConfig, app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    const dataConnectService = firebaseApp.getOrInitService('dataConnect', (app) => new data_connect_1.DataConnectService(app));
    return dataConnectService.getDataConnect(connectorConfig);
}
