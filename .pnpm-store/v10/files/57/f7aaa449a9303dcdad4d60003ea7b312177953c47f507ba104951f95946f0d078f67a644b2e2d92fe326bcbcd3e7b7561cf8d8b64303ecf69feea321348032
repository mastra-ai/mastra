/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIREBASE_CONFIG_VAR = exports.defaultAppStore = exports.AppStore = void 0;
exports.initializeApp = initializeApp;
exports.getApp = getApp;
exports.getApps = getApps;
exports.deleteApp = deleteApp;
const fs = require("fs");
const validator = require("../utils/validator");
const error_1 = require("../utils/error");
const credential_internal_1 = require("./credential-internal");
const firebase_app_1 = require("./firebase-app");
const fastDeepEqual = require('fast-deep-equal');
const DEFAULT_APP_NAME = '[DEFAULT]';
class AppStore {
    constructor() {
        this.appStore = new Map();
    }
    initializeApp(options, appName = DEFAULT_APP_NAME) {
        validateAppNameFormat(appName);
        let autoInit = false;
        if (typeof options === 'undefined') {
            autoInit = true;
            options = loadOptionsFromEnvVar();
            options.credential = (0, credential_internal_1.getApplicationDefault)();
        }
        // Check if an app already exists and, if so, ensure its `AppOptions` match
        // those of this `initializeApp` request. 
        if (!this.appStore.has(appName)) {
            const app = new firebase_app_1.FirebaseApp(options, appName, autoInit, this);
            this.appStore.set(app.name, app);
            return app;
        }
        const currentApp = this.appStore.get(appName);
        // Ensure the `autoInit` state matches the existing app's. If not, throw.
        if (currentApp.autoInit() !== autoInit) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, `A Firebase app named "${appName}" already exists with a different configuration.`);
        }
        if (autoInit) {
            // Auto-initialization is triggered when no options were passed to
            // `initializeApp`. With no options to compare, simply return the App.
            return currentApp;
        }
        // Ensure the options objects don't break deep equal comparisons.
        validateAppOptionsSupportDeepEquals(options, currentApp);
        // `FirebaseApp()` adds a synthesized `Credential` to `app.options` upon
        // app construction. Run a comparison w/o `Credential` to see if the base
        // configurations match. Return the existing app if so.
        const currentAppOptions = { ...currentApp.options };
        delete currentAppOptions.credential;
        if (!fastDeepEqual(options, currentAppOptions)) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.DUPLICATE_APP, `A Firebase app named "${appName}" already exists with a different configuration.`);
        }
        return currentApp;
    }
    getApp(appName = DEFAULT_APP_NAME) {
        validateAppNameFormat(appName);
        if (!this.appStore.has(appName)) {
            let errorMessage = (appName === DEFAULT_APP_NAME)
                ? 'The default Firebase app does not exist. ' : `Firebase app named "${appName}" does not exist. `;
            errorMessage += 'Make sure you call initializeApp() before using any of the Firebase services.';
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.NO_APP, errorMessage);
        }
        return this.appStore.get(appName);
    }
    getApps() {
        // Return a copy so the caller cannot mutate the array
        return Array.from(this.appStore.values());
    }
    deleteApp(app) {
        if (typeof app !== 'object' || app === null || !('options' in app)) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_ARGUMENT, 'Invalid app argument.');
        }
        // Make sure the given app already exists.
        const existingApp = getApp(app.name);
        // Delegate delete operation to the App instance itself. That will also remove the App
        // instance from the AppStore.
        return existingApp.delete();
    }
    clearAllApps() {
        const promises = [];
        this.getApps().forEach((app) => {
            promises.push(this.deleteApp(app));
        });
        return Promise.all(promises).then();
    }
    /**
     * Removes the specified App instance from the store. This is currently called by the
     * {@link FirebaseApp.delete} method. Can be removed once the app deletion is handled
     * entirely by the {@link deleteApp} top-level function.
     */
    removeApp(appName) {
        this.appStore.delete(appName);
    }
}
exports.AppStore = AppStore;
/**
 * Validates that the `requestedOptions` and the `existingApp` options objects
 * do not have fields that would break deep equals comparisons.
 *
 * @param requestedOptions The incoming `AppOptions` of a new `initailizeApp`
 *   request.
 * @param existingApp An existing `FirebaseApp` with internal `options` to
 *   compare against.
 *
 * @throws FirebaseAppError if the objects cannot be deeply compared.
 *
 * @internal
 */
function validateAppOptionsSupportDeepEquals(requestedOptions, existingApp) {
    // http.Agent checks.
    if (typeof requestedOptions.httpAgent !== 'undefined') {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, `Firebase app named "${existingApp.name}" already exists and initializeApp was` +
            ' invoked with an optional http.Agent. The SDK cannot confirm the equality' +
            ' of http.Agent objects with the existing app. Please use getApp or getApps to reuse' +
            ' the existing app instead.');
    }
    else if (typeof existingApp.options.httpAgent !== 'undefined') {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, `An existing app named "${existingApp.name}" already exists with a different` +
            ' options configuration: httpAgent.');
    }
    // Credential checks.
    if (typeof requestedOptions.credential !== 'undefined') {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, `Firebase app named "${existingApp.name}" already exists and initializeApp was` +
            ' invoked with an optional Credential. The SDK cannot confirm the equality' +
            ' of Credential objects with the existing app. Please use getApp or getApps' +
            ' to reuse the existing app instead.');
    }
    if (existingApp.customCredential()) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, `An existing app named "${existingApp.name}" already exists with a different` +
            ' options configuration: Credential.');
    }
}
/**
 * Checks to see if the provided appName is a non-empty string and throws if it
 * is not.
 *
 * @param appName A string representation of an App name.
 *
 * @throws FirebaseAppError if appName is not of type string or is empty.
 *
 * @internal
 */
function validateAppNameFormat(appName) {
    if (!validator.isNonEmptyString(appName)) {
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_NAME, `Invalid Firebase app name "${appName}" provided. App name must be a non-empty string.`);
    }
}
exports.defaultAppStore = new AppStore();
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
function initializeApp(options, appName = DEFAULT_APP_NAME) {
    return exports.defaultAppStore.initializeApp(options, appName);
}
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
function getApp(appName = DEFAULT_APP_NAME) {
    return exports.defaultAppStore.getApp(appName);
}
/**
 * A (read-only) array of all initialized apps.
 *
 * @returns An array containing all initialized apps.
 */
function getApps() {
    return exports.defaultAppStore.getApps();
}
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
function deleteApp(app) {
    return exports.defaultAppStore.deleteApp(app);
}
/**
 * Constant holding the environment variable name with the default config.
 * If the environment variable contains a string that starts with '{' it will be parsed as JSON,
 * otherwise it will be assumed to be pointing to a file.
 */
exports.FIREBASE_CONFIG_VAR = 'FIREBASE_CONFIG';
/**
 * Parse the file pointed to by the FIREBASE_CONFIG_VAR, if it exists.
 * Or if the FIREBASE_CONFIG_ENV contains a valid JSON object, parse it directly.
 * If the environment variable contains a string that starts with '{' it will be parsed as JSON,
 * otherwise it will be assumed to be pointing to a file.
 */
function loadOptionsFromEnvVar() {
    const config = process.env[exports.FIREBASE_CONFIG_VAR];
    if (!validator.isNonEmptyString(config)) {
        return {};
    }
    try {
        const contents = config.startsWith('{') ? config : fs.readFileSync(config, 'utf8');
        return JSON.parse(contents);
    }
    catch (error) {
        // Throw a nicely formed error message if the file contents cannot be parsed
        throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, 'Failed to parse app options file: ' + error);
    }
}
