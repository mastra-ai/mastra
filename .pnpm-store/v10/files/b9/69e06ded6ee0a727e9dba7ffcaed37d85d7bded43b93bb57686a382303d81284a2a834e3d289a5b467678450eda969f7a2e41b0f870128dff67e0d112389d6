/*! firebase-admin v13.5.0 */
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
/**
 * Firebase project management.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { ProjectManagement } from './project-management';
export { AppMetadata, AppPlatform } from './app-metadata';
export { ProjectManagement } from './project-management';
export { AndroidApp, AndroidAppMetadata, ShaCertificate } from './android-app';
export { IosApp, IosAppMetadata } from './ios-app';
/**
 * Gets the {@link ProjectManagement} service for the default app or a given app.
 *
 * `getProjectManagement()` can be called with no arguments to access the
 * default app's `ProjectManagement` service, or as `getProjectManagement(app)` to access
 * the `ProjectManagement` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the ProjectManagement service for the default app
 * const defaultProjectManagement = getProjectManagement();
 * ```
 *
 * @example
 * ```javascript
 * // Get the ProjectManagement service for a given app
 * const otherProjectManagement = getProjectManagement(otherApp);
 * ```
 *
 * @param app - Optional app whose `ProjectManagement` service
 *     to return. If not provided, the default `ProjectManagement` service will
 *     be returned. *
 * @returns The default `ProjectManagement` service if no app is provided or the
 *   `ProjectManagement` service associated with the provided app.
 */
export declare function getProjectManagement(app?: App): ProjectManagement;
export { FirebaseProjectManagementError, ProjectManagementErrorCode } from '../utils/error';
