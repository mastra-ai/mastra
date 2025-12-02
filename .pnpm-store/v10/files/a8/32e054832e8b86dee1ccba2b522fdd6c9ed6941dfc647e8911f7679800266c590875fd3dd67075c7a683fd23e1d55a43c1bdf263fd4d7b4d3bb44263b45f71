/*! firebase-admin v13.5.0 */
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
/**
 * Firebase Data Connect service.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { DataConnect } from './data-connect';
import { ConnectorConfig } from './data-connect-api';
export { GraphqlOptions, ExecuteGraphqlResponse, ConnectorConfig, ImpersonateAuthenticated, ImpersonateUnauthenticated, AuthClaims } from './data-connect-api';
export { DataConnect, } from './data-connect';
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
export declare function getDataConnect(connectorConfig: ConnectorConfig, app?: App): DataConnect;
