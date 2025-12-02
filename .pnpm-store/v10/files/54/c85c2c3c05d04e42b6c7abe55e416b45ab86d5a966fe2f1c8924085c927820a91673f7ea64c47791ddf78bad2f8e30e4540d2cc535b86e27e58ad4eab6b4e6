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
import * as rtdb from '@firebase/database-types';
import { App } from '../app';
import { Database as TDatabase } from './database';
/**
 * Gets the {@link firebase-admin.database#Database} service for the default
 * app or a given app.
 *
 * `admin.database()` can be called with no arguments to access the default
 * app's `Database` service or as `admin.database(app)` to access the
 * `Database` service associated with a specific app.
 *
 * `admin.database` is also a namespace that can be used to access global
 * constants and methods associated with the `Database` service.
 *
 * @example
 * ```javascript
 * // Get the Database service for the default app
 * var defaultDatabase = admin.database();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Database service for a specific app
 * var otherDatabase = admin.database(app);
 * ```
 *
 * @param App - whose `Database` service to
 *   return. If not provided, the default `Database` service will be returned.
 *
 * @returns The default `Database` service if no app
 *   is provided or the `Database` service associated with the provided app.
 */
export declare function database(app?: App): database.Database;
export declare namespace database {
    /**
     * Type alias to {@link firebase-admin.database#Database}.
     */
    type Database = TDatabase;
    /**
     * Type alias to {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.DataSnapshot | DataSnapshot}
     * type from the `@firebase/database-compat` package.
     */
    type DataSnapshot = rtdb.DataSnapshot;
    /**
     * Type alias to the {@link https://firebase.google.com/docs/reference/js/v8/firebase.database#eventtype | EventType}
     * type from the `@firebase/database-compat` package.
     */
    type EventType = rtdb.EventType;
    /**
     * Type alias to {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.OnDisconnect | OnDisconnect}
     * type from the `@firebase/database-compat` package.
     */
    type OnDisconnect = rtdb.OnDisconnect;
    /**
     * Type alias to {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.Query | Query}
     * type from the `@firebase/database-compat` package.
     */
    type Query = rtdb.Query;
    /**
     * Type alias to {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.Reference | Reference}
     * type from the `@firebase/database-compat` package.
     */
    type Reference = rtdb.Reference;
    /**
     * Type alias to {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.ThenableReference |
     * ThenableReference} type from the `@firebase/database-compat` package.
     */
    type ThenableReference = rtdb.ThenableReference;
    /**
     * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database#enablelogging | enableLogging}
     * function from the `@firebase/database-compat` package.
     */
    const enableLogging: typeof rtdb.enableLogging;
    /**
     * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.ServerValue | ServerValue}
     * constant from the `@firebase/database-compat` package.
     */
    const ServerValue: rtdb.ServerValue;
}
