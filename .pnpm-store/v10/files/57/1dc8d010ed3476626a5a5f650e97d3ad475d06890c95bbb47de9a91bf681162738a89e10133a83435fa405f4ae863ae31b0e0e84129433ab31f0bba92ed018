/**
 * @license
 * Copyright 2020 Google LLC
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
import { _FirebaseService, FirebaseApp } from '@firebase/app';
import { AppCheckInternalComponentName } from '@firebase/app-check-interop-types';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { Provider } from '@firebase/component';
import { EmulatorMockTokenOptions } from '@firebase/util';
import { Repo } from '../core/Repo';
import { ReferenceImpl } from './Reference_impl';
export { EmulatorMockTokenOptions } from '@firebase/util';
/**
 * This function should only ever be called to CREATE a new database instance.
 * @internal
 */
export declare function repoManagerDatabaseFromApp(app: FirebaseApp, authProvider: Provider<FirebaseAuthInternalName>, appCheckProvider?: Provider<AppCheckInternalComponentName>, url?: string, nodeAdmin?: boolean): Database;
/**
 * Forces us to use ReadonlyRestClient instead of PersistentConnection for new Repos.
 */
export declare function repoManagerForceRestClient(forceRestClient: boolean): void;
/**
 * Class representing a Firebase Realtime Database.
 */
export declare class Database implements _FirebaseService {
    _repoInternal: Repo;
    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
    readonly app: FirebaseApp;
    /** Represents a `Database` instance. */
    readonly 'type' = "database";
    /** Track if the instance has been used (root or repo accessed) */
    _instanceStarted: boolean;
    /** Backing state for root_ */
    private _rootInternal?;
    /** @hideconstructor */
    constructor(_repoInternal: Repo, 
    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
    app: FirebaseApp);
    get _repo(): Repo;
    get _root(): ReferenceImpl;
    _delete(): Promise<void>;
    _checkNotDeleted(apiName: string): void;
}
/**
 * Force the use of websockets instead of longPolling.
 */
export declare function forceWebSockets(): void;
/**
 * Force the use of longPolling instead of websockets. This will be ignored if websocket protocol is used in databaseURL.
 */
export declare function forceLongPolling(): void;
/**
 * Returns the instance of the Realtime Database SDK that is associated with the provided
 * {@link @firebase/app#FirebaseApp}. Initializes a new instance with default settings if
 * no instance exists or if the existing instance uses a custom database URL.
 *
 * @param app - The {@link @firebase/app#FirebaseApp} instance that the returned Realtime
 * Database instance is associated with.
 * @param url - The URL of the Realtime Database instance to connect to. If not
 * provided, the SDK connects to the default instance of the Firebase App.
 * @returns The `Database` instance of the provided app.
 */
export declare function getDatabase(app?: FirebaseApp, url?: string): Database;
/**
 * Modify the provided instance to communicate with the Realtime Database
 * emulator.
 *
 * <p>Note: This method must be called before performing any other operation.
 *
 * @param db - The instance to modify.
 * @param host - The emulator host (ex: localhost)
 * @param port - The emulator port (ex: 8080)
 * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
 */
export declare function connectDatabaseEmulator(db: Database, host: string, port: number, options?: {
    mockUserToken?: EmulatorMockTokenOptions | string;
}): void;
/**
 * Disconnects from the server (all Database operations will be completed
 * offline).
 *
 * The client automatically maintains a persistent connection to the Database
 * server, which will remain active indefinitely and reconnect when
 * disconnected. However, the `goOffline()` and `goOnline()` methods may be used
 * to control the client connection in cases where a persistent connection is
 * undesirable.
 *
 * While offline, the client will no longer receive data updates from the
 * Database. However, all Database operations performed locally will continue to
 * immediately fire events, allowing your application to continue behaving
 * normally. Additionally, each operation performed locally will automatically
 * be queued and retried upon reconnection to the Database server.
 *
 * To reconnect to the Database and begin receiving remote events, see
 * `goOnline()`.
 *
 * @param db - The instance to disconnect.
 */
export declare function goOffline(db: Database): void;
/**
 * Reconnects to the server and synchronizes the offline Database state
 * with the server state.
 *
 * This method should be used after disabling the active connection with
 * `goOffline()`. Once reconnected, the client will transmit the proper data
 * and fire the appropriate events so that your client "catches up"
 * automatically.
 *
 * @param db - The instance to reconnect.
 */
export declare function goOnline(db: Database): void;
/**
 * Logs debugging information to the console.
 *
 * @param enabled - Enables logging if `true`, disables logging if `false`.
 * @param persistent - Remembers the logging state between page refreshes if
 * `true`.
 */
export declare function enableLogging(enabled: boolean, persistent?: boolean): any;
/**
 * Logs debugging information to the console.
 *
 * @param logger - A custom logger function to control how things get logged.
 */
export declare function enableLogging(logger: (message: string) => unknown): any;
