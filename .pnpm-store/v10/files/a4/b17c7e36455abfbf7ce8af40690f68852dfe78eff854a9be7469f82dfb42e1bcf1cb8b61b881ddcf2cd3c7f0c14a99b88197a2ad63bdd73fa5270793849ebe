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
import { Firestore, Settings } from '@google-cloud/firestore';
import { App } from '../app';
/**
 * Settings to pass to the Firestore constructor.
 *
 * @public
 */
export interface FirestoreSettings {
    /**
     * Use HTTP/1.1 REST transport where possible.
     *
     * `preferRest` will force the use of HTTP/1.1 REST transport until a method
     * that requires gRPC is called. When a method requires gRPC, this Firestore
     * client will load dependent gRPC libraries and then use gRPC transport for
     * all communication from that point forward. Currently the only operation
     * that requires gRPC is creating a snapshot listener using `onSnapshot()`.
     *
     * @defaultValue `undefined`
     */
    preferRest?: boolean;
}
export declare class FirestoreService {
    private readonly appInternal;
    private readonly databases;
    private readonly firestoreSettings;
    constructor(app: App);
    initializeDatabase(databaseId: string, settings: FirestoreSettings): Firestore;
    getDatabase(databaseId: string): Firestore;
    private checkIfSameSettings;
    /**
     * Returns the app associated with this Storage instance.
     *
     * @returns The app associated with this Storage instance.
     */
    get app(): App;
}
export declare function getFirestoreOptions(app: App, firestoreSettings?: FirestoreSettings): Settings;
