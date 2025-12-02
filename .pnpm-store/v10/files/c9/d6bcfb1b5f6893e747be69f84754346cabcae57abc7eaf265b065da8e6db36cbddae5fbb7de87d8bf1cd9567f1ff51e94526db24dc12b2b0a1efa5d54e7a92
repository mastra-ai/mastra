/*! firebase-admin v13.5.0 */
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
/**
 * Firebase Eventarc.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { Eventarc } from './eventarc';
export { CloudEvent, CloudEventVersion } from './cloudevent';
export { Eventarc, Channel, ChannelOptions } from './eventarc';
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
export declare function getEventarc(app?: App): Eventarc;
