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
import { Agent } from 'http';
import { Credential } from './credential';
/**
 * Available options to pass to {@link firebase-admin.app#initializeApp}.
 */
export interface AppOptions {
    /**
     * A {@link firebase-admin.app#Credential} object used to
     * authenticate the Admin SDK.
     *
     * See {@link https://firebase.google.com/docs/admin/setup#initialize_the_sdk | Initialize the SDK}
     * for detailed documentation and code samples.
     */
    credential?: Credential;
    /**
     * The object to use as the {@link https://firebase.google.com/docs/reference/security/database/#auth | auth}
     * variable in your Realtime Database Rules when the Admin SDK reads from or
     * writes to the Realtime Database. This allows you to downscope the Admin SDK
     * from its default full read and write privileges.
     *
     * You can pass `null` to act as an unauthenticated client.
     *
     * See
     * {@link https://firebase.google.com/docs/database/admin/start#authenticate-with-limited-privileges |
     * Authenticate with limited privileges}
     * for detailed documentation and code samples.
     */
    databaseAuthVariableOverride?: object | null;
    /**
     * The URL of the Realtime Database from which to read and write data.
     */
    databaseURL?: string;
    /**
     * The ID of the service account to be used for signing custom tokens. This
     * can be found in the `client_email` field of a service account JSON file.
     */
    serviceAccountId?: string;
    /**
     * The name of the Google Cloud Storage bucket used for storing application data.
     * Use only the bucket name without any prefixes or additions (do *not* prefix
     * the name with "gs://").
     */
    storageBucket?: string;
    /**
     * The ID of the Google Cloud project associated with the App.
     */
    projectId?: string;
    /**
     * An {@link https://nodejs.org/api/http.html#http_class_http_agent | HTTP Agent}
     * to be used when making outgoing HTTP calls. This Agent instance is used
     * by all services that make REST calls (e.g. `auth`, `messaging`,
     * `projectManagement`).
     *
     * Realtime Database and Firestore use other means of communicating with
     * the backend servers, so they do not use this HTTP Agent. `Credential`
     * instances also do not use this HTTP Agent, but instead support
     * specifying an HTTP Agent in the corresponding factory methods.
     */
    httpAgent?: Agent;
}
/**
 * A Firebase app holds the initialization information for a collection of
 * services.
 */
export interface App {
    /**
     * The (read-only) name for this app.
     *
     * The default app's name is `"[DEFAULT]"`.
     *
     * @example
     * ```javascript
     * // The default app's name is "[DEFAULT]"
     * initializeApp(defaultAppConfig);
     * console.log(admin.app().name);  // "[DEFAULT]"
     * ```
     *
     * @example
     * ```javascript
     * // A named app's name is what you provide to initializeApp()
     * const otherApp = initializeApp(otherAppConfig, "other");
     * console.log(otherApp.name);  // "other"
     * ```
     */
    name: string;
    /**
     * The (read-only) configuration options for this app. These are the original
     * parameters given in {@link firebase-admin.app#initializeApp}.
     *
     * @example
     * ```javascript
     * const app = initializeApp(config);
     * console.log(app.options.credential === config.credential);  // true
     * console.log(app.options.databaseURL === config.databaseURL);  // true
     * ```
     */
    options: AppOptions;
}
/**
 * `FirebaseError` is a subclass of the standard JavaScript `Error` object. In
 * addition to a message string and stack trace, it contains a string code.
 */
export interface FirebaseError {
    /**
     * Error codes are strings using the following format: `"service/string-code"`.
     * Some examples include `"auth/invalid-uid"` and
     * `"messaging/invalid-recipient"`.
     *
     * While the message for a given error can change, the code will remain the same
     * between backward-compatible versions of the Firebase SDK.
     */
    code: string;
    /**
     * An explanatory message for the error that just occurred.
     *
     * This message is designed to be helpful to you, the developer. Because
     * it generally does not convey meaningful information to end users,
     * this message should not be displayed in your application.
     */
    message: string;
    /**
     * A string value containing the execution backtrace when the error originally
     * occurred.
     *
     * This information can be useful for troubleshooting the cause of the error with
     * {@link https://firebase.google.com/support | Firebase Support}.
     */
    stack?: string;
    /**
     * Returns a JSON-serializable object representation of this error.
     *
     * @returns A JSON-serializable representation of this object.
     */
    toJSON(): object;
}
/**
 * Composite type which includes both a `FirebaseError` object and an index
 * which can be used to get the errored item.
 *
 * @example
 * ```javascript
 * var registrationTokens = [token1, token2, token3];
 * admin.messaging().subscribeToTopic(registrationTokens, 'topic-name')
 *   .then(function(response) {
 *     if (response.failureCount > 0) {
 *       console.log("Following devices unsucessfully subscribed to topic:");
 *       response.errors.forEach(function(error) {
 *         var invalidToken = registrationTokens[error.index];
 *         console.log(invalidToken, error.error);
 *       });
 *     } else {
 *       console.log("All devices successfully subscribed to topic:", response);
 *     }
 *   })
 *   .catch(function(error) {
 *     console.log("Error subscribing to topic:", error);
 *   });
 *```
 */
export interface FirebaseArrayIndexError {
    /**
     * The index of the errored item within the original array passed as part of the
     * called API method.
     */
    index: number;
    /**
     * The error object.
     */
    error: FirebaseError;
}
