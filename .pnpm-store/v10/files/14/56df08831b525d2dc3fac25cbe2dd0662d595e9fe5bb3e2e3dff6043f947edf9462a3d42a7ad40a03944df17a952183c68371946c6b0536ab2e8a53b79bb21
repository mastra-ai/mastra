/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirebaseError = createFirebaseError;
exports.getErrorCode = getErrorCode;
const error_1 = require("../utils/error");
const validator = require("../utils/validator");
/**
 * Creates a new `FirebaseMessagingError` by extracting the error code, message and other relevant
 * details from a `RequestResponseError` response.
 *
 * @param err - The `RequestResponseError` to convert into a Firebase error
 * @returns A Firebase error that can be returned to the user.
 */
function createFirebaseError(err) {
    if (err.response.isJson()) {
        // For JSON responses, map the server response to a client-side error.
        const json = err.response.data;
        const errorCode = getErrorCode(json);
        const errorMessage = getErrorMessage(json);
        return error_1.FirebaseMessagingError.fromServerError(errorCode, errorMessage, json);
    }
    // Non-JSON response
    let error;
    switch (err.response.status) {
        case 400:
            error = error_1.MessagingClientErrorCode.INVALID_ARGUMENT;
            break;
        case 401:
        case 403:
            error = error_1.MessagingClientErrorCode.AUTHENTICATION_ERROR;
            break;
        case 500:
            error = error_1.MessagingClientErrorCode.INTERNAL_ERROR;
            break;
        case 503:
            error = error_1.MessagingClientErrorCode.SERVER_UNAVAILABLE;
            break;
        default:
            // Treat non-JSON responses with unexpected status codes as unknown errors.
            error = error_1.MessagingClientErrorCode.UNKNOWN_ERROR;
    }
    return new error_1.FirebaseMessagingError({
        code: error.code,
        message: `${error.message} Raw server response: "${err.response.text}". Status code: ` +
            `${err.response.status}.`,
    });
}
/**
 * @param response - The response to check for errors.
 * @returns The error code if present; null otherwise.
 */
function getErrorCode(response) {
    if (validator.isNonNullObject(response) && 'error' in response) {
        const error = response.error;
        if (validator.isString(error)) {
            return error;
        }
        if (validator.isArray(error.details)) {
            const fcmErrorType = 'type.googleapis.com/google.firebase.fcm.v1.FcmError';
            for (const element of error.details) {
                if (element['@type'] === fcmErrorType) {
                    return element.errorCode;
                }
            }
        }
        if ('status' in error) {
            return error.status;
        }
        else {
            return error.message;
        }
    }
    return null;
}
/**
 * Extracts error message from the given response object.
 *
 * @param response - The response to check for errors.
 * @returns The error message if present; null otherwise.
 */
function getErrorMessage(response) {
    if (validator.isNonNullObject(response) &&
        'error' in response &&
        validator.isNonEmptyString(response.error.message)) {
        return response.error.message;
    }
    return null;
}
