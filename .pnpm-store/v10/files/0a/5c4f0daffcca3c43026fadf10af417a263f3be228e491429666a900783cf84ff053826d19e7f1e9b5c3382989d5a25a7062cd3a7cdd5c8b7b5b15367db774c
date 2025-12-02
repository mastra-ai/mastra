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
exports.FirestoreService = void 0;
exports.getFirestoreOptions = getFirestoreOptions;
const error_1 = require("../utils/error");
const credential_internal_1 = require("../app/credential-internal");
const validator = require("../utils/validator");
const utils = require("../utils/index");
class FirestoreService {
    constructor(app) {
        this.databases = new Map();
        this.firestoreSettings = new Map();
        this.appInternal = app;
    }
    initializeDatabase(databaseId, settings) {
        const existingInstance = this.databases.get(databaseId);
        if (existingInstance) {
            const initialSettings = this.firestoreSettings.get(databaseId) ?? {};
            if (this.checkIfSameSettings(settings, initialSettings)) {
                return existingInstance;
            }
            throw new error_1.FirebaseFirestoreError({
                code: 'failed-precondition',
                message: 'initializeFirestore() has already been called with ' +
                    'different options. To avoid this error, call initializeFirestore() with the ' +
                    'same options as when it was originally called, or call getFirestore() to return the' +
                    ' already initialized instance.'
            });
        }
        const newInstance = initFirestore(this.app, databaseId, settings);
        this.databases.set(databaseId, newInstance);
        this.firestoreSettings.set(databaseId, settings);
        return newInstance;
    }
    getDatabase(databaseId) {
        let database = this.databases.get(databaseId);
        if (database === undefined) {
            database = initFirestore(this.app, databaseId, {});
            this.databases.set(databaseId, database);
            this.firestoreSettings.set(databaseId, {});
        }
        return database;
    }
    checkIfSameSettings(settingsA, settingsB) {
        const a = settingsA ?? {};
        const b = settingsB ?? {};
        // If we start passing more settings to Firestore constructor,
        // replace this with deep equality check.
        return (a.preferRest === b.preferRest);
    }
    /**
     * Returns the app associated with this Storage instance.
     *
     * @returns The app associated with this Storage instance.
     */
    get app() {
        return this.appInternal;
    }
}
exports.FirestoreService = FirestoreService;
function getFirestoreOptions(app, firestoreSettings) {
    if (!validator.isNonNullObject(app) || !('options' in app)) {
        throw new error_1.FirebaseFirestoreError({
            code: 'invalid-argument',
            message: 'First argument passed to admin.firestore() must be a valid Firebase app instance.',
        });
    }
    const projectId = utils.getExplicitProjectId(app);
    const credential = app.options.credential;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdkVersion = utils.getSdkVersion();
    const preferRest = firestoreSettings?.preferRest;
    if (credential instanceof credential_internal_1.ServiceAccountCredential) {
        return {
            credentials: {
                private_key: credential.privateKey,
                client_email: credential.clientEmail,
            },
            // When the SDK is initialized with ServiceAccountCredentials an explicit projectId is
            // guaranteed to be available.
            projectId: projectId,
            firebaseVersion: sdkVersion,
            firebaseAdminVersion: sdkVersion,
            preferRest,
        };
    }
    else if ((0, credential_internal_1.isApplicationDefault)(app.options.credential)) {
        // Try to use the Google application default credentials.
        // If an explicit project ID is not available, let Firestore client discover one from the
        // environment. This prevents the users from having to set GOOGLE_CLOUD_PROJECT in GCP runtimes.
        return validator.isNonEmptyString(projectId)
            ? {
                projectId,
                firebaseVersion: sdkVersion,
                firebaseAdminVersion: sdkVersion,
                preferRest
            }
            : {
                firebaseVersion: sdkVersion,
                firebaseAdminVersion: sdkVersion,
                preferRest
            };
    }
    throw new error_1.FirebaseFirestoreError({
        code: 'invalid-credential',
        message: 'Failed to initialize Google Cloud Firestore client with the available credentials. ' +
            'Must initialize the SDK with a certificate credential or application default credentials ' +
            'to use Cloud Firestore API.',
    });
}
function initFirestore(app, databaseId, firestoreSettings) {
    const options = getFirestoreOptions(app, firestoreSettings);
    options.databaseId = databaseId;
    let firestoreDatabase;
    try {
        // Lazy-load the Firestore implementation here, which in turns loads gRPC.
        firestoreDatabase = require('@google-cloud/firestore').Firestore;
    }
    catch (err) {
        throw new error_1.FirebaseFirestoreError({
            code: 'missing-dependencies',
            message: 'Failed to import the Cloud Firestore client library for Node.js. '
                + 'Make sure to install the "@google-cloud/firestore" npm package. '
                + `Original error: ${err}`,
        });
    }
    return new firestoreDatabase(options);
}
