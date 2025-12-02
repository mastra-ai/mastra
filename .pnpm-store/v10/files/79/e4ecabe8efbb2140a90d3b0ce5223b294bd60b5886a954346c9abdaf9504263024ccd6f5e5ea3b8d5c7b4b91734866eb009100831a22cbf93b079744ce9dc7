/*! firebase-admin v13.5.0 */
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
/**
 * Firebase Functions service.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { Functions } from './functions';
export { DelayDelivery, AbsoluteDelivery, DeliverySchedule, TaskOptions, TaskOptionsExperimental, } from './functions-api';
export { Functions, TaskQueue } from './functions';
/**
 * Gets the {@link Functions} service for the default app
 * or a given app.
 *
 * `getFunctions()` can be called with no arguments to access the default
 * app's `Functions` service or as `getFunctions(app)` to access the
 * `Functions` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the `Functions` service for the default app
 * const defaultFunctions = getFunctions();
 * ```
 *
 * @example
 * ```javascript
 * // Get the `Functions` service for a given app
 * const otherFunctions = getFunctions(otherApp);
 * ```
 *
 * @param app - Optional app for which to return the `Functions` service.
 *   If not provided, the default `Functions` service is returned.
 *
 * @returns The default `Functions` service if no app is provided, or the `Functions`
 *   service associated with the provided app.
 */
export declare function getFunctions(app?: App): Functions;
