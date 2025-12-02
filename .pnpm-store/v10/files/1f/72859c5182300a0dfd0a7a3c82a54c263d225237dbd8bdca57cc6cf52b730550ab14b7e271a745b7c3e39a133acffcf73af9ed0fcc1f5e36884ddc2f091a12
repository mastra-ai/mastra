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
 * Firebase Realtime Database.
 *
 * @packageDocumentation
 */
import * as rtdb from '@firebase/database-types';
import { App } from '../app';
import { Database } from './database';
export { Database };
export { DataSnapshot, EventType, OnDisconnect, Query, Reference, ThenableReference, } from '@firebase/database-types';
/**
 * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database#enablelogging | enableLogging}
 * function from the `@firebase/database-compat` package.
 */
export declare const enableLogging: typeof rtdb.enableLogging;
/**
 * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.ServerValue | ServerValue}
 * constant from the `@firebase/database-compat` package.
 */
export declare const ServerValue: rtdb.ServerValue;
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
export declare function getDatabase(app?: App): Database;
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
export declare function getDatabaseWithUrl(url: string, app?: App): Database;
export { FirebaseDatabaseError } from '../utils/error';
