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
import { FirebaseDatabase } from '@firebase/database-types';
import { App } from '../app';
/**
 * The Firebase Database service interface. Extends the
 * {@link https://firebase.google.com/docs/reference/js/v8/firebase.database.Database | Database}
 * interface provided by the `@firebase/database-compat` package.
 */
export interface Database extends FirebaseDatabase {
    /**
     * Gets the currently applied security rules as a string. The return value consists of
     * the rules source including comments.
     *
     * @returns A promise fulfilled with the rules as a raw string.
     */
    getRules(): Promise<string>;
    /**
     * Gets the currently applied security rules as a parsed JSON object. Any comments in
     * the original source are stripped away.
     *
     * @returns A promise fulfilled with the parsed rules object.
     */
    getRulesJSON(): Promise<object>;
    /**
     * Sets the specified rules on the Firebase Realtime Database instance. If the rules source is
     * specified as a string or a Buffer, it may include comments.
     *
     * @param source - Source of the rules to apply. Must not be `null` or empty.
     * @returns Resolves when the rules are set on the Realtime Database.
     */
    setRules(source: string | Buffer | object): Promise<void>;
}
export declare class DatabaseService {
    private readonly appInternal;
    private tokenListener;
    private tokenRefreshTimeout;
    private databases;
    constructor(app: App);
    private get firebaseApp();
    /**
     * Returns the app associated with this DatabaseService instance.
     *
     * @returns The app associated with this DatabaseService instance.
     */
    get app(): App;
    getDatabase(url?: string): Database;
    private onTokenChange;
    private scheduleTokenRefresh;
    private ensureUrl;
}
