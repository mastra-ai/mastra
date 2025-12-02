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
 * Cloud Storage for Firebase.
 *
 * @packageDocumentation
 */
import { File } from '@google-cloud/storage';
import { App } from '../app';
import { Storage } from './storage';
export { Storage } from './storage';
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
export declare function getStorage(app?: App): Storage;
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
export declare function getDownloadURL(file: File): Promise<string>;
