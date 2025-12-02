/*! firebase-admin v13.5.0 */
/*!
 * Copyright 2019 Google Inc.
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
import { RequestResponseError } from '../utils/api-request';
import { FirebaseMessagingError } from '../utils/error';
/**
 * Creates a new `FirebaseMessagingError` by extracting the error code, message and other relevant
 * details from a `RequestResponseError` response.
 *
 * @param err - The `RequestResponseError` to convert into a Firebase error
 * @returns A Firebase error that can be returned to the user.
 */
export declare function createFirebaseError(err: RequestResponseError): FirebaseMessagingError;
/**
 * @param response - The response to check for errors.
 * @returns The error code if present; null otherwise.
 */
export declare function getErrorCode(response: any): string | null;
