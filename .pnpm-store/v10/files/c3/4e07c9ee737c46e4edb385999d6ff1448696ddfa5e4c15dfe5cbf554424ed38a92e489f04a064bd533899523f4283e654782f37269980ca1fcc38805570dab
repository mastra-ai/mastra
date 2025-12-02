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
exports.FirebaseDatabaseError = exports.ServerValue = exports.enableLogging = void 0;
exports.getDatabase = getDatabase;
exports.getDatabaseWithUrl = getDatabaseWithUrl;
const standalone_1 = require("@firebase/database-compat/standalone");
const app_1 = require("../app");
const database_1 = require("./database");
// TODO: Remove the following any-cast once the typins in @firebase/database-types are fixed.
/**
 * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database#enablelogging | enableLogging}
 * function from the `@firebase/database-compat` package.
 */
exports.enableLogging = standalone_1.enableLogging;
/**
 * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.ServerValue | ServerValue}
 * constant from the `@firebase/database-compat` package.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.ServerValue = standalone_1.ServerValue;
/**
 * Gets the {@link Database} service for the default
 * app or a given app.
 *
 * `getDatabase()` can be called with no arguments to access the default
 * app's `Database` service or as `getDatabase(app)` to access the
 * `Database` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Database service for the default app
 * const defaultDatabase = getDatabase();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Database service for a specific app
 * const otherDatabase = getDatabase(app);
 * ```
 *
 * @param App - whose `Database` service to
 *   return. If not provided, the default `Database` service will be returned.
 *
 * @returns The default `Database` service if no app
 *   is provided or the `Database` service associated with the provided app.
 */
function getDatabase(app) {
    return getDatabaseInstance({ app });
}
/**
 * Gets the {@link Database} service for the default
 * app or a given app.
 *
 * `getDatabaseWithUrl()` can be called with no arguments to access the default
 * app's {@link Database} service or as `getDatabaseWithUrl(app)` to access the
 * {@link Database} service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Database service for the default app
 * const defaultDatabase = getDatabaseWithUrl('https://example.firebaseio.com');
 * ```
 *
 * @example
 * ```javascript
 * // Get the Database service for a specific app
 * const otherDatabase = getDatabaseWithUrl('https://example.firebaseio.com', app);
 * ```
 *
 * @param App - whose `Database` service to
 *   return. If not provided, the default `Database` service will be returned.
 *
 * @returns The default `Database` service if no app
 *   is provided or the `Database` service associated with the provided app.
 */
function getDatabaseWithUrl(url, app) {
    return getDatabaseInstance({ url, app });
}
function getDatabaseInstance(options) {
    let { app } = options;
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    const dbService = firebaseApp.getOrInitService('database', (app) => new database_1.DatabaseService(app));
    return dbService.getDatabase(options.url);
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseDatabaseError", { enumerable: true, get: function () { return error_1.FirebaseDatabaseError; } });
