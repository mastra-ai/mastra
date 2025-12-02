/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const url_1 = require("url");
const path = require("path");
const error_1 = require("../utils/error");
const validator = require("../utils/validator");
const api_request_1 = require("../utils/api-request");
const index_1 = require("../utils/index");
const TOKEN_REFRESH_THRESHOLD_MILLIS = 5 * 60 * 1000;
class DatabaseService {
    constructor(app) {
        this.databases = {};
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new error_1.FirebaseDatabaseError({
                code: 'invalid-argument',
                message: 'First argument passed to admin.database() must be a valid Firebase app instance.',
            });
        }
        this.appInternal = app;
    }
    get firebaseApp() {
        return this.app;
    }
    /**
     * @internal
     */
    delete() {
        if (this.tokenListener) {
            this.firebaseApp.INTERNAL.removeAuthTokenListener(this.tokenListener);
            clearTimeout(this.tokenRefreshTimeout);
        }
        const promises = [];
        for (const dbUrl of Object.keys(this.databases)) {
            const db = this.databases[dbUrl];
            promises.push(db.INTERNAL.delete());
        }
        return Promise.all(promises).then(() => {
            this.databases = {};
        });
    }
    /**
     * Returns the app associated with this DatabaseService instance.
     *
     * @returns The app associated with this DatabaseService instance.
     */
    get app() {
        return this.appInternal;
    }
    getDatabase(url) {
        const dbUrl = this.ensureUrl(url);
        if (!validator.isNonEmptyString(dbUrl)) {
            throw new error_1.FirebaseDatabaseError({
                code: 'invalid-argument',
                message: 'Database URL must be a valid, non-empty URL string.',
            });
        }
        let db = this.databases[dbUrl];
        if (typeof db === 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const rtdb = require('@firebase/database-compat/standalone');
            db = rtdb.initStandalone(this.appInternal, dbUrl, (0, index_1.getSdkVersion)()).instance;
            const rulesClient = new DatabaseRulesClient(this.app, dbUrl);
            db.getRules = () => {
                return rulesClient.getRules();
            };
            db.getRulesJSON = () => {
                return rulesClient.getRulesJSON();
            };
            db.setRules = (source) => {
                return rulesClient.setRules(source);
            };
            this.databases[dbUrl] = db;
        }
        if (!this.tokenListener) {
            this.tokenListener = this.onTokenChange.bind(this);
            this.firebaseApp.INTERNAL.addAuthTokenListener(this.tokenListener);
        }
        return db;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onTokenChange(_) {
        const token = this.firebaseApp.INTERNAL.getCachedToken();
        if (token) {
            const delayMillis = token.expirationTime - TOKEN_REFRESH_THRESHOLD_MILLIS - Date.now();
            // If the new token is set to expire soon (unlikely), do nothing. Somebody will eventually
            // notice and refresh the token, at which point this callback will fire again.
            if (delayMillis > 0) {
                this.scheduleTokenRefresh(delayMillis);
            }
        }
    }
    scheduleTokenRefresh(delayMillis) {
        clearTimeout(this.tokenRefreshTimeout);
        this.tokenRefreshTimeout = setTimeout(() => {
            this.firebaseApp.INTERNAL.getToken(/*forceRefresh=*/ true)
                .catch(() => {
                // Ignore the error since this might just be an intermittent failure. If we really cannot
                // refresh the token, an error will be logged once the existing token expires and we try
                // to fetch a fresh one.
            });
        }, delayMillis);
    }
    ensureUrl(url) {
        if (typeof url !== 'undefined') {
            return url;
        }
        else if (typeof this.appInternal.options.databaseURL !== 'undefined') {
            return this.appInternal.options.databaseURL;
        }
        throw new error_1.FirebaseDatabaseError({
            code: 'invalid-argument',
            message: 'Can\'t determine Firebase Database URL.',
        });
    }
}
exports.DatabaseService = DatabaseService;
const RULES_URL_PATH = '.settings/rules.json';
/**
 * A helper client for managing RTDB security rules.
 */
class DatabaseRulesClient {
    constructor(app, dbUrl) {
        let parsedUrl = new url_1.URL(dbUrl);
        const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
        if (emulatorHost) {
            const namespace = extractNamespace(parsedUrl);
            parsedUrl = new url_1.URL(`http://${emulatorHost}?ns=${namespace}`);
        }
        parsedUrl.pathname = path.join(parsedUrl.pathname, RULES_URL_PATH);
        this.dbUrl = parsedUrl.toString();
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
    }
    /**
     * Gets the currently applied security rules as a string. The return value consists of
     * the rules source including comments.
     *
     * @returns A promise fulfilled with the rules as a raw string.
     */
    getRules() {
        const req = {
            method: 'GET',
            url: this.dbUrl,
        };
        return this.httpClient.send(req)
            .then((resp) => {
            if (!resp.text) {
                throw new error_1.FirebaseAppError(error_1.AppErrorCodes.INTERNAL_ERROR, 'HTTP response missing data.');
            }
            return resp.text;
        })
            .catch((err) => {
            throw this.handleError(err);
        });
    }
    /**
     * Gets the currently applied security rules as a parsed JSON object. Any comments in
     * the original source are stripped away.
     *
     * @returns {Promise<object>} A promise fulfilled with the parsed rules source.
     */
    getRulesJSON() {
        const req = {
            method: 'GET',
            url: this.dbUrl,
            data: { format: 'strict' },
        };
        return this.httpClient.send(req)
            .then((resp) => {
            return resp.data;
        })
            .catch((err) => {
            throw this.handleError(err);
        });
    }
    /**
     * Sets the specified rules on the Firebase Database instance. If the rules source is
     * specified as a string or a Buffer, it may include comments.
     *
     * @param {string|Buffer|object} source Source of the rules to apply. Must not be `null`
     *  or empty.
     * @returns {Promise<void>} Resolves when the rules are set on the Database.
     */
    setRules(source) {
        if (!validator.isNonEmptyString(source) &&
            !validator.isBuffer(source) &&
            !validator.isNonNullObject(source)) {
            const error = new error_1.FirebaseDatabaseError({
                code: 'invalid-argument',
                message: 'Source must be a non-empty string, Buffer or an object.',
            });
            return Promise.reject(error);
        }
        const req = {
            method: 'PUT',
            url: this.dbUrl,
            data: source,
            headers: {
                'content-type': 'application/json; charset=utf-8',
            },
        };
        return this.httpClient.send(req)
            .then(() => {
            return;
        })
            .catch((err) => {
            throw this.handleError(err);
        });
    }
    handleError(err) {
        if (err instanceof api_request_1.RequestResponseError) {
            return new error_1.FirebaseDatabaseError({
                code: error_1.AppErrorCodes.INTERNAL_ERROR,
                message: this.getErrorMessage(err),
            });
        }
        return err;
    }
    getErrorMessage(err) {
        const intro = 'Error while accessing security rules';
        try {
            const body = err.response.data;
            if (body && body.error) {
                return `${intro}: ${body.error.trim()}`;
            }
        }
        catch {
            // Ignore parsing errors
        }
        return `${intro}: ${err.response.text}`;
    }
}
function extractNamespace(parsedUrl) {
    const ns = parsedUrl.searchParams.get('ns');
    if (ns) {
        return ns;
    }
    const hostname = parsedUrl.hostname;
    const dotIndex = hostname.indexOf('.');
    return hostname.substring(0, dotIndex).toLowerCase();
}
