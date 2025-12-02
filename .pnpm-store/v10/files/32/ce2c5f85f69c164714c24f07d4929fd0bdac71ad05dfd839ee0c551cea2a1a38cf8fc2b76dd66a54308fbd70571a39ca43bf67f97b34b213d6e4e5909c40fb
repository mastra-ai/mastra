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
export declare const EMULATED_SERVICE_ACCOUNT_DEFAULT = "emulated-service-acct@email.com";
/**
 * Task is a limited subset of https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks#resource:-task
 * containing the relevant fields for enqueueing tasks that tirgger Cloud Functions.
 */
export interface Task {
    name?: string;
    scheduleTime?: string;
    dispatchDeadline?: string;
    httpRequest: {
        url: string;
        oidcToken?: {
            serviceAccountEmail: string;
        };
        body: string;
        headers: {
            [key: string]: string;
        };
    };
}
export declare const FUNCTIONS_ERROR_CODE_MAPPING: {
    [key: string]: FunctionsErrorCode;
};
export type FunctionsErrorCode = 'aborted' | 'invalid-argument' | 'invalid-credential' | 'internal-error' | 'failed-precondition' | 'permission-denied' | 'unauthenticated' | 'not-found' | 'unknown-error' | 'task-already-exists';
/**
 * Firebase Functions error code structure. This extends PrefixedFirebaseError.
 *
 * @param code - The error code.
 * @param message - The error message.
 * @constructor
 */
export declare class FirebaseFunctionsError extends PrefixedFirebaseError {
    constructor(code: FunctionsErrorCode, message: string);
}
