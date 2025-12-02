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
exports.Storage = void 0;
exports.getStorage = getStorage;
exports.getDownloadURL = getDownloadURL;
const app_1 = require("../app");
const storage_1 = require("./storage");
const error_1 = require("../utils/error");
const utils_1 = require("./utils");
var storage_2 = require("./storage");
Object.defineProperty(exports, "Storage", { enumerable: true, get: function () { return storage_2.Storage; } });
/**
 * Gets the {@link Storage} service for the default app or a given app.
 *
 * `getStorage()` can be called with no arguments to access the default
 * app's `Storage` service or as `getStorage(app)` to access the
 * `Storage` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the Storage service for the default app
 * const defaultStorage = getStorage();
 * ```
 *
 * @example
 * ```javascript
 * // Get the Storage service for a given app
 * const otherStorage = getStorage(otherApp);
 * ```
 */
function getStorage(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('storage', (app) => new storage_1.Storage(app));
}
/**
 * Gets the download URL for the given {@link https://cloud.google.com/nodejs/docs/reference/storage/latest/storage/file | File}.
 *
 * @example
 * ```javascript
 * // Get the downloadUrl for a given file ref
 * const storage = getStorage();
 * const myRef = ref(storage, 'images/mountains.jpg');
 * const downloadUrl = await getDownloadURL(myRef);
 * ```
 */
async function getDownloadURL(file) {
    const endpoint = (process.env.STORAGE_EMULATOR_HOST ||
        'https://firebasestorage.googleapis.com') + '/v0';
    const { downloadTokens } = await (0, utils_1.getFirebaseMetadata)(endpoint, file);
    if (!downloadTokens) {
        throw new error_1.FirebaseError({
            code: 'storage/no-download-token',
            message: 'No download token available. Please create one in the Firebase Console.',
        });
    }
    const [token] = downloadTokens.split(',');
    return `${endpoint}/b/${file.bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
}
