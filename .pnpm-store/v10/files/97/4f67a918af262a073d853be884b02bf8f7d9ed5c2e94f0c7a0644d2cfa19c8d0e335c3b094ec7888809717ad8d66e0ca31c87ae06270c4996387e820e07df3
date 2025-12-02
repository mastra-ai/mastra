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
import { App, AppOptions } from './core';
export declare class AppStore {
    private readonly appStore;
    initializeApp(options?: AppOptions, appName?: string): App;
    getApp(appName?: string): App;
    getApps(): App[];
    deleteApp(app: App): Promise<void>;
    clearAllApps(): Promise<void>;
    /**
     * Removes the specified App instance from the store. This is currently called by the
     * {@link FirebaseApp.delete} method. Can be removed once the app deletion is handled
     * entirely by the {@link deleteApp} top-level function.
     */
    removeApp(appName: string): void;
}
export declare const defaultAppStore: AppStore;
/**
 * Initializes the `App` instance.
 *
 * Creates a new instance of {@link App} if one doesn't exist, or returns an existing
 * `App` instance if one exists with the same `appName` and `options`.
 *
 * Note, due to the inablity to compare `http.Agent` objects and `Credential` objects,
 * this function cannot support idempotency if either of `options.httpAgent` or
 * `options.credential` are defined. When either is defined, subsequent invocations will
 * throw a `FirebaseAppError` instead of returning an `App` object.
 *
 * For example, to safely initialize an app that may already exist:
 *
 * ```javascript
 * let app;
 * try {
 *   app = getApp("myApp");
 * } catch (error) {
 *   app = initializeApp({ credential: myCredential }, "myApp");
 * }
 * ```
 *
 * @param options - Optional A set of {@link AppOptions} for the `App` instance.
 *   If not present, `initializeApp` will try to initialize with the options from the
 *   `FIREBASE_CONFIG` environment variable. If the environment variable contains a
 *   string that starts with `{` it will be parsed as JSON, otherwise it will be
 *   assumed to be pointing to a file.
 * @param appName - Optional name of the `App` instance.
 *
 * @returns A new App instance, or the existing App if the instance already exists with
 *   the provided configuration.
 *
 * @throws FirebaseAppError if an `App` with the same name has already been
 *   initialized with a different set of `AppOptions`.
 * @throws FirebaseAppError if an existing `App` exists and `options.httpAgent`
 *   or `options.credential` are defined. This is due to the function's inability to
 *   determine if the existing `App`'s `options` equate to the `options` parameter
 *   of this function. It's recommended to use {@link getApp} or {@link getApps} if your
 *   implementation uses either of these two fields in `AppOptions`.
 */
export declare function initializeApp(options?: AppOptions, appName?: string): App;
/**
 * Returns an existing {@link App} instance for the provided name. If no name
 * is provided the the default app name is used.
 *
 * @param appName - Optional name of the `App` instance.
 *
 * @returns An existing `App` instance that matches the name provided.
 *
 * @throws FirebaseAppError if no `App` exists for the given name.
 * @throws FirebaseAppError if the `appName` is malformed.
 */
export declare function getApp(appName?: string): App;
/**
 * A (read-only) array of all initialized apps.
 *
 * @returns An array containing all initialized apps.
 */
export declare function getApps(): App[];
/**
 * Renders this given `App` unusable and frees the resources of
 * all associated services (though it does *not* clean up any backend
 * resources). When running the SDK locally, this method
 * must be called to ensure graceful termination of the process.
 *
 * @example
 * ```javascript
 * deleteApp(app)
 *   .then(function() {
 *     console.log("App deleted successfully");
 *   })
 *   .catch(function(error) {
 *     console.log("Error deleting app:", error);
 *   });
 * ```
 */
export declare function deleteApp(app: App): Promise<void>;
/**
 * Constant holding the environment variable name with the default config.
 * If the environment variable contains a string that starts with '{' it will be parsed as JSON,
 * otherwise it will be assumed to be pointing to a file.
 */
export declare const FIREBASE_CONFIG_VAR = "FIREBASE_CONFIG";
