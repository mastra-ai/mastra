/*! firebase-admin v13.5.0 */
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
import { App } from '../app/index';
import { Installations as TInstallations } from './installations';
/**
 * Gets the {@link firebase-admin.installations#Installations} service for the
 * default app or a given app.
 *
 * `admin.installations()` can be called with no arguments to access the default
 * app's {@link firebase-admin.installations#Installations} service or as
 * `admin.installations(app)` to access the
 * {@link firebase-admin.installations#Installations} service associated with a
 * specific app.
 *
 * @example
 * ```javascript
 * // Get the Installations service for the default app
 * var defaultInstallations = admin.installations();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Installations service for a given app
 * var otherInstallations = admin.installations(otherApp);
 *```
 *
 * @param app - Optional app whose `Installations` service to
 *   return. If not provided, the default `Installations` service is
 *   returned.
 *
 * @returns The default `Installations` service if
 *   no app is provided or the `Installations` service associated with the
 *   provided app.
 */
export declare function installations(app?: App): installations.Installations;
export declare namespace installations {
    /**
     * Type alias to {@link firebase-admin.installations#Installations}.
     */
    type Installations = TInstallations;
}
