/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
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
exports.FirebaseApp = exports.FirebaseAppInternals = void 0;
const credential_internal_1 = require("./credential-internal");
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
const error_1 = require("../utils/error");
const TOKEN_EXPIRY_THRESHOLD_MILLIS = 5 * 60 * 1000;
/**
 * Internals of a FirebaseApp instance.
 */
class FirebaseAppInternals {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    constructor(credential_) {
        this.credential_ = credential_;
        this.tokenListeners_ = [];
        this.isRefreshing = false;
    }
    getToken(forceRefresh = false) {
        if (forceRefresh || this.shouldRefresh()) {
            this.promiseToCachedToken_ = this.refreshToken();
        }
        return this.promiseToCachedToken_;
    }
    getCachedToken() {
        return this.cachedToken_ || null;
    }
    refreshToken() {
        this.isRefreshing = true;
        return Promise.resolve(this.credential_.getAccessToken())
            .then((result) => {
            // Since the developer can provide the credential implementation, we want to weakly verify
            // the return type until the type is properly exported.
            if (!validator.isNonNullObject(result) ||
                typeof result.expires_in !== 'number' ||
                typeof result.access_token !== 'string') {
                throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, `Invalid access token generated: "${JSON.stringify(result)}". Valid access ` +
                    'tokens must be an object with the "expires_in" (number) and "access_token" ' +
                    '(string) properties.');
            }
            const token = {
                accessToken: result.access_token,
                expirationTime: Date.now() + (result.expires_in * 1000),
            };
            if (!this.cachedToken_
                || this.cachedToken_.accessToken !== token.accessToken
                || this.cachedToken_.expirationTime !== token.expirationTime) {
                // Update the cache before firing listeners. Listeners may directly query the
                // cached token state.
                this.cachedToken_ = token;
                this.tokenListeners_.forEach((listener) => {
                    listener(token.accessToken);
                });
            }
            return token;
        })
            .catch((error) => {
            let errorMessage = (typeof error === 'string') ? error : error.message;
            errorMessage = 'Credential implementation provided to initializeApp() via the ' +
                '"credential" property failed to fetch a valid Google OAuth2 access token with the ' +
                `following error: "${errorMessage}".`;
            if (errorMessage.indexOf('invalid_grant') !== -1) {
                errorMessage += ' There are two likely causes: (1) your server time is not properly ' +
                    'synced or (2) your certificate key file has been revoked. To solve (1), re-sync the ' +
                    'time on your server. To solve (2), make sure the key ID for your key file is still ' +
                    'present at https://console.firebase.google.com/iam-admin/serviceaccounts/project. If ' +
                    'not, generate a new key file at ' +
                    'https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk.';
            }
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_CREDENTIAL, errorMessage);
        })
            .finally(() => {
            this.isRefreshing = false;
        });
    }
    shouldRefresh() {
        return (!this.cachedToken_ || (this.cachedToken_.expirationTime - Date.now()) <= TOKEN_EXPIRY_THRESHOLD_MILLIS)
            && !this.isRefreshing;
    }
    /**
     * Adds a listener that is called each time a token changes.
     *
     * @param listener - The listener that will be called with each new token.
     */
    addAuthTokenListener(listener) {
        this.tokenListeners_.push(listener);
        if (this.cachedToken_) {
            listener(this.cachedToken_.accessToken);
        }
    }
    /**
     * Removes a token listener.
     *
     * @param listener - The listener to remove.
     */
    removeAuthTokenListener(listener) {
        this.tokenListeners_ = this.tokenListeners_.filter((other) => other !== listener);
    }
}
exports.FirebaseAppInternals = FirebaseAppInternals;
/**
 * Global context object for a collection of services using a shared authentication state.
 *
 * @internal
 */
class FirebaseApp {
    constructor(options, name, autoInit = false, appStore) {
        this.appStore = appStore;
        this.services_ = {};
        this.isDeleted_ = false;
        this.autoInit_ = false;
        this.customCredential_ = true;
        this.name_ = name;
        this.options_ = (0, deep_copy_1.deepCopy)(options);
        this.autoInit_ = autoInit;
        if (!validator.isNonNullObject(this.options_)) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, 'Invalid Firebase app options passed as the first argument to initializeApp() for the ' +
                `app named "${this.name_}". Options must be a non-null object.`);
        }
        const hasCredential = ('credential' in this.options_);
        if (!hasCredential) {
            this.customCredential_ = false;
            this.options_.credential = (0, credential_internal_1.getApplicationDefault)(this.options_.httpAgent);
        }
        const credential = this.options_.credential;
        if (typeof credential !== 'object' || credential === null || typeof credential.getAccessToken !== 'function') {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INVALID_APP_OPTIONS, 'Invalid Firebase app options passed as the first argument to initializeApp() for the ' +
                `app named "${this.name_}". The "credential" property must be an object which implements ` +
                'the Credential interface.');
        }
        this.INTERNAL = new FirebaseAppInternals(credential);
    }
    /**
     * Returns the name of the FirebaseApp instance.
     *
     * @returns The name of the FirebaseApp instance.
     */
    get name() {
        this.checkDestroyed_();
        return this.name_;
    }
    /**
     * Returns the options for the FirebaseApp instance.
     *
     * @returns The options for the FirebaseApp instance.
     */
    get options() {
        this.checkDestroyed_();
        return (0, deep_copy_1.deepCopy)(this.options_);
    }
    /**
     * @internal
     */
    getOrInitService(name, init) {
        return this.ensureService_(name, () => init(this));
    }
    /**
     * Returns `true` if this app was initialized with auto-initialization.
     *
     * @internal
     */
    autoInit() {
        return this.autoInit_;
    }
    /**
     * Returns `true` if the `FirebaseApp` instance was initialized with a custom
     * `Credential`.
     *
     * @internal
     */
    customCredential() {
        return this.customCredential_;
    }
    /**
     * Deletes the FirebaseApp instance.
     *
     * @returns An empty Promise fulfilled once the FirebaseApp instance is deleted.
     */
    delete() {
        this.checkDestroyed_();
        // Also remove the instance from the AppStore. This is needed to support the existing
        // app.delete() use case. In the future we can remove this API, and deleteApp() will
        // become the only way to tear down an App.
        this.appStore?.removeApp(this.name);
        return Promise.all(Object.keys(this.services_).map((serviceName) => {
            const service = this.services_[serviceName];
            if (isStateful(service)) {
                return service.delete();
            }
            return Promise.resolve();
        })).then(() => {
            this.services_ = {};
            this.isDeleted_ = true;
        });
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ensureService_(serviceName, initializer) {
        this.checkDestroyed_();
        if (!(serviceName in this.services_)) {
            this.services_[serviceName] = initializer();
        }
        return this.services_[serviceName];
    }
    /**
     * Throws an Error if the FirebaseApp instance has already been deleted.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    checkDestroyed_() {
        if (this.isDeleted_) {
            throw new error_1.FirebaseAppError(error_1.AppErrorCodes.APP_DELETED, `Firebase app named "${this.name_}" has already been deleted.`);
        }
    }
}
exports.FirebaseApp = FirebaseApp;
function isStateful(service) {
    return typeof service.delete === 'function';
}
