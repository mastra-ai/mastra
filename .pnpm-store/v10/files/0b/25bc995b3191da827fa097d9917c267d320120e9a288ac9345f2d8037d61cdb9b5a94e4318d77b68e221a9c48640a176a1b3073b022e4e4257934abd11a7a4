/*! firebase-admin v13.5.0 */
/*!
 * @license
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
import { PrefixedFirebaseError } from '../utils/error';
export declare const APP_CHECK_ERROR_CODE_MAPPING: {
    [key: string]: AppCheckErrorCode;
};
export type AppCheckErrorCode = 'aborted' | 'invalid-argument' | 'invalid-credential' | 'internal-error' | 'permission-denied' | 'unauthenticated' | 'not-found' | 'app-check-token-expired' | 'unknown-error';
/**
 * Firebase App Check error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
export declare class FirebaseAppCheckError extends PrefixedFirebaseError {
    constructor(code: AppCheckErrorCode, message: string);
}
