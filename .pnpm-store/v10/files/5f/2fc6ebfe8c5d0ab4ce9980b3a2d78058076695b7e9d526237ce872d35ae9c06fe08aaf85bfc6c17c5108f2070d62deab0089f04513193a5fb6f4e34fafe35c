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
 * Firebase Extensions service.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { Extensions } from './extensions';
export { Extensions, Runtime } from './extensions';
export { SettableProcessingState } from './extensions-api';
/**
  * Gets the {@link Extensions} service for the default app
  * or a given app.
  *
  * `getExtensions()` can be called with no arguments to access the default
  * app's `Extensions` service or as `getExtensions(app)` to access the
  * `Extensions` service associated with a specific app.
  *
  * @example
  * ```javascript
  * // Get the `Extensions` service for the default app
  * const defaultExtensions = getExtensions();
  * ```
  *
  * @example
  * ```javascript
  * // Get the `Extensions` service for a given app
  * const otherExtensions = getExtensions(otherApp);
  * ```
  *
  * @param app - Optional app for which to return the `Extensions` service.
  *   If not provided, the default `Extensions` service is returned.
  *
  * @returns The default `Extensions` service if no app is provided, or the `Extensions`
  *   service associated with the provided app.
  */
export declare function getExtensions(app?: App): Extensions;
