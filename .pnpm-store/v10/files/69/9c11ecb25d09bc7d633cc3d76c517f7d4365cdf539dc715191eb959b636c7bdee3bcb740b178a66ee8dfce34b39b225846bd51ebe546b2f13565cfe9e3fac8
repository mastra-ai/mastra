/*! firebase-admin v13.5.0 */
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
import { AppStore } from './lifecycle';
import { app, appCheck, auth, messaging, machineLearning, storage, firestore, database, instanceId, installations, projectManagement, securityRules, remoteConfig, AppOptions } from '../firebase-namespace-api';
import { cert, refreshToken, applicationDefault } from './credential-factory';
import App = app.App;
import AppCheck = appCheck.AppCheck;
import Auth = auth.Auth;
import Database = database.Database;
import Firestore = firestore.Firestore;
import Installations = installations.Installations;
import InstanceId = instanceId.InstanceId;
import MachineLearning = machineLearning.MachineLearning;
import Messaging = messaging.Messaging;
import ProjectManagement = projectManagement.ProjectManagement;
import RemoteConfig = remoteConfig.RemoteConfig;
import SecurityRules = securityRules.SecurityRules;
import Storage = storage.Storage;
export interface FirebaseServiceNamespace<T> {
    (app?: App): T;
    [key: string]: any;
}
/**
 * Internals of a FirebaseNamespace instance.
 */
export declare class FirebaseNamespaceInternals {
    private readonly appStore;
    constructor(appStore: AppStore);
    /**
     * Initializes the App instance.
     *
     * @param options - Optional options for the App instance. If none present will try to initialize
     *   from the FIREBASE_CONFIG environment variable. If the environment variable contains a string
     *   that starts with '{' it will be parsed as JSON, otherwise it will be assumed to be pointing
     *   to a file.
     * @param appName - Optional name of the FirebaseApp instance.
     *
     * @returns A new App instance.
     */
    initializeApp(options?: AppOptions, appName?: string): App;
    /**
     * Returns the App instance with the provided name (or the default App instance
     * if no name is provided).
     *
     * @param appName - Optional name of the FirebaseApp instance to return.
     * @returns The App instance which has the provided name.
     */
    app(appName?: string): App;
    get apps(): App[];
}
/**
 * Global Firebase context object.
 */
export declare class FirebaseNamespace {
    __esModule: boolean;
    credential: {
        cert: typeof cert;
        refreshToken: typeof refreshToken;
        applicationDefault: typeof applicationDefault;
    };
    SDK_VERSION: string;
    INTERNAL: FirebaseNamespaceInternals;
    Promise: any;
    constructor(appStore?: AppStore);
    /**
     * Gets the `Auth` service namespace. The returned namespace can be used to get the
     * `Auth` service for the default app or an explicitly specified app.
     */
    get auth(): FirebaseServiceNamespace<Auth>;
    /**
     * Gets the `Database` service namespace. The returned namespace can be used to get the
     * `Database` service for the default app or an explicitly specified app.
     */
    get database(): FirebaseServiceNamespace<Database>;
    /**
     * Gets the `Messaging` service namespace. The returned namespace can be used to get the
     * `Messaging` service for the default app or an explicitly specified app.
     */
    get messaging(): FirebaseServiceNamespace<Messaging>;
    /**
     * Gets the `Storage` service namespace. The returned namespace can be used to get the
     * `Storage` service for the default app or an explicitly specified app.
     */
    get storage(): FirebaseServiceNamespace<Storage>;
    /**
     * Gets the `Firestore` service namespace. The returned namespace can be used to get the
     * `Firestore` service for the default app or an explicitly specified app.
     */
    get firestore(): FirebaseServiceNamespace<Firestore>;
    /**
     * Gets the `MachineLearning` service namespace. The returned namespace can be
     * used to get the `MachineLearning` service for the default app or an
     * explicityly specified app.
     */
    get machineLearning(): FirebaseServiceNamespace<MachineLearning>;
    /**
     * Gets the `Installations` service namespace. The returned namespace can be used to get the
     * `Installations` service for the default app or an explicitly specified app.
     */
    get installations(): FirebaseServiceNamespace<Installations>;
    /**
     * Gets the `InstanceId` service namespace. The returned namespace can be used to get the
     * `Instance` service for the default app or an explicitly specified app.
     */
    get instanceId(): FirebaseServiceNamespace<InstanceId>;
    /**
     * Gets the `ProjectManagement` service namespace. The returned namespace can be used to get the
     * `ProjectManagement` service for the default app or an explicitly specified app.
     */
    get projectManagement(): FirebaseServiceNamespace<ProjectManagement>;
    /**
     * Gets the `SecurityRules` service namespace. The returned namespace can be used to get the
     * `SecurityRules` service for the default app or an explicitly specified app.
     */
    get securityRules(): FirebaseServiceNamespace<SecurityRules>;
    /**
     * Gets the `RemoteConfig` service namespace. The returned namespace can be used to get the
     * `RemoteConfig` service for the default app or an explicitly specified app.
     */
    get remoteConfig(): FirebaseServiceNamespace<RemoteConfig>;
    /**
     * Gets the `AppCheck` service namespace. The returned namespace can be used to get the
     * `AppCheck` service for the default app or an explicitly specified app.
     */
    get appCheck(): FirebaseServiceNamespace<AppCheck>;
    /**
     * Initializes the FirebaseApp instance.
     *
     * @param options - Optional options for the FirebaseApp instance.
     *   If none present will try to initialize from the FIREBASE_CONFIG environment variable.
     *   If the environment variable contains a string that starts with '{' it will be parsed as JSON,
     *   otherwise it will be assumed to be pointing to a file.
     * @param appName - Optional name of the FirebaseApp instance.
     *
     * @returns A new FirebaseApp instance.
     */
    initializeApp(options?: AppOptions, appName?: string): App;
    /**
     * Returns the FirebaseApp instance with the provided name (or the default FirebaseApp instance
     * if no name is provided).
     *
     * @param appName - Optional name of the FirebaseApp instance to return.
     * @returns The FirebaseApp instance which has the provided name.
     */
    app(appName?: string): App;
    get apps(): App[];
    private ensureApp;
}
