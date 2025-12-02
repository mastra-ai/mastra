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
import { appCheck } from './app-check/app-check-namespace';
import { auth } from './auth/auth-namespace';
import { database } from './database/database-namespace';
import { firestore } from './firestore/firestore-namespace';
import { instanceId } from './instance-id/instance-id-namespace';
import { installations } from './installations/installations-namespace';
import { machineLearning } from './machine-learning/machine-learning-namespace';
import { messaging } from './messaging/messaging-namespace';
import { projectManagement } from './project-management/project-management-namespace';
import { remoteConfig } from './remote-config/remote-config-namespace';
import { securityRules } from './security-rules/security-rules-namespace';
import { storage } from './storage/storage-namespace';
import { App as AppCore, AppOptions } from './app/index';
export { AppOptions, FirebaseError, FirebaseArrayIndexError } from './app/index';
export declare namespace app {
    /**
     * A Firebase app holds the initialization information for a collection of
     * services.
     *
     * Do not call this constructor directly. Instead, use
     * {@link firebase-admin.app#initializeApp} to create an app.
     */
    interface App extends AppCore {
        appCheck(): appCheck.AppCheck;
        auth(): auth.Auth;
        database(url?: string): database.Database;
        firestore(): firestore.Firestore;
        installations(): installations.Installations;
        /**
         * @deprecated Use {@link firebase-admin.installations#Installations} instead.
         */
        instanceId(): instanceId.InstanceId;
        machineLearning(): machineLearning.MachineLearning;
        messaging(): messaging.Messaging;
        projectManagement(): projectManagement.ProjectManagement;
        remoteConfig(): remoteConfig.RemoteConfig;
        securityRules(): securityRules.SecurityRules;
        storage(): storage.Storage;
        /**
         * Renders this local `FirebaseApp` unusable and frees the resources of
         * all associated services (though it does *not* clean up any backend
         * resources). When running the SDK locally, this method
         * must be called to ensure graceful termination of the process.
         *
         * @example
         * ```javascript
         * app.delete()
         *   .then(function() {
         *     console.log("App deleted successfully");
         *   })
         *   .catch(function(error) {
         *     console.log("Error deleting app:", error);
         *   });
         * ```
         */
        delete(): Promise<void>;
    }
}
export * from './credential/index';
export { appCheck } from './app-check/app-check-namespace';
export { auth } from './auth/auth-namespace';
export { database } from './database/database-namespace';
export { firestore } from './firestore/firestore-namespace';
export { instanceId } from './instance-id/instance-id-namespace';
export { installations } from './installations/installations-namespace';
export { machineLearning } from './machine-learning/machine-learning-namespace';
export { messaging } from './messaging/messaging-namespace';
export { projectManagement } from './project-management/project-management-namespace';
export { remoteConfig } from './remote-config/remote-config-namespace';
export { securityRules } from './security-rules/security-rules-namespace';
export { storage } from './storage/storage-namespace';
export declare const SDK_VERSION: string;
export declare const apps: (app.App | null)[];
export declare function app(name?: string): app.App;
export declare function initializeApp(options?: AppOptions, name?: string): app.App;
