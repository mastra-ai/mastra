/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2022 Google Inc.
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
import { CloudEvent } from './cloudevent';
export type EventarcErrorCode = 'unknown-error' | 'invalid-argument';
/**
 * Firebase Eventarc error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
export declare class FirebaseEventarcError extends PrefixedFirebaseError {
    constructor(code: EventarcErrorCode, message: string);
}
export declare function toCloudEventProtoFormat(ce: CloudEvent): any;
