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
exports.FirebaseFirestoreError = exports.setLogFunction = exports.v1 = exports.WriteResult = exports.WriteBatch = exports.Transaction = exports.Timestamp = exports.QuerySnapshot = exports.QueryPartition = exports.QueryDocumentSnapshot = exports.Query = exports.GrpcStatus = exports.GeoPoint = exports.Firestore = exports.Filter = exports.FieldValue = exports.FieldPath = exports.DocumentSnapshot = exports.DocumentReference = exports.CollectionReference = exports.CollectionGroup = exports.BundleBuilder = exports.BulkWriter = exports.AggregateQuerySnapshot = exports.AggregateQuery = exports.AggregateField = void 0;
exports.getFirestore = getFirestore;
exports.initializeFirestore = initializeFirestore;
const app_1 = require("../app");
const firestore_internal_1 = require("./firestore-internal");
const path_1 = require("@google-cloud/firestore/build/src/path");
var firestore_1 = require("@google-cloud/firestore");
Object.defineProperty(exports, "AggregateField", { enumerable: true, get: function () { return firestore_1.AggregateField; } });
Object.defineProperty(exports, "AggregateQuery", { enumerable: true, get: function () { return firestore_1.AggregateQuery; } });
Object.defineProperty(exports, "AggregateQuerySnapshot", { enumerable: true, get: function () { return firestore_1.AggregateQuerySnapshot; } });
Object.defineProperty(exports, "BulkWriter", { enumerable: true, get: function () { return firestore_1.BulkWriter; } });
Object.defineProperty(exports, "BundleBuilder", { enumerable: true, get: function () { return firestore_1.BundleBuilder; } });
Object.defineProperty(exports, "CollectionGroup", { enumerable: true, get: function () { return firestore_1.CollectionGroup; } });
Object.defineProperty(exports, "CollectionReference", { enumerable: true, get: function () { return firestore_1.CollectionReference; } });
Object.defineProperty(exports, "DocumentReference", { enumerable: true, get: function () { return firestore_1.DocumentReference; } });
Object.defineProperty(exports, "DocumentSnapshot", { enumerable: true, get: function () { return firestore_1.DocumentSnapshot; } });
Object.defineProperty(exports, "FieldPath", { enumerable: true, get: function () { return firestore_1.FieldPath; } });
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return firestore_1.FieldValue; } });
Object.defineProperty(exports, "Filter", { enumerable: true, get: function () { return firestore_1.Filter; } });
Object.defineProperty(exports, "Firestore", { enumerable: true, get: function () { return firestore_1.Firestore; } });
Object.defineProperty(exports, "GeoPoint", { enumerable: true, get: function () { return firestore_1.GeoPoint; } });
Object.defineProperty(exports, "GrpcStatus", { enumerable: true, get: function () { return firestore_1.GrpcStatus; } });
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return firestore_1.Query; } });
Object.defineProperty(exports, "QueryDocumentSnapshot", { enumerable: true, get: function () { return firestore_1.QueryDocumentSnapshot; } });
Object.defineProperty(exports, "QueryPartition", { enumerable: true, get: function () { return firestore_1.QueryPartition; } });
Object.defineProperty(exports, "QuerySnapshot", { enumerable: true, get: function () { return firestore_1.QuerySnapshot; } });
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return firestore_1.Timestamp; } });
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return firestore_1.Transaction; } });
Object.defineProperty(exports, "WriteBatch", { enumerable: true, get: function () { return firestore_1.WriteBatch; } });
Object.defineProperty(exports, "WriteResult", { enumerable: true, get: function () { return firestore_1.WriteResult; } });
Object.defineProperty(exports, "v1", { enumerable: true, get: function () { return firestore_1.v1; } });
Object.defineProperty(exports, "setLogFunction", { enumerable: true, get: function () { return firestore_1.setLogFunction; } });
function getFirestore(appOrDatabaseId, optionalDatabaseId) {
    const app = typeof appOrDatabaseId === 'object' ? appOrDatabaseId : (0, app_1.getApp)();
    const databaseId = (typeof appOrDatabaseId === 'string' ? appOrDatabaseId : optionalDatabaseId) || path_1.DEFAULT_DATABASE_ID;
    const firebaseApp = app;
    const firestoreService = firebaseApp.getOrInitService('firestore', (app) => new firestore_internal_1.FirestoreService(app));
    return firestoreService.getDatabase(databaseId);
}
function initializeFirestore(app, settings, databaseId) {
    settings ?? (settings = {});
    databaseId ?? (databaseId = path_1.DEFAULT_DATABASE_ID);
    const firebaseApp = app;
    const firestoreService = firebaseApp.getOrInitService('firestore', (app) => new firestore_internal_1.FirestoreService(app));
    return firestoreService.initializeDatabase(databaseId, settings);
}
var error_1 = require("../utils/error");
Object.defineProperty(exports, "FirebaseFirestoreError", { enumerable: true, get: function () { return error_1.FirebaseFirestoreError; } });
