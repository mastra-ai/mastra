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
exports.FirebaseMessagingRequestHandler = void 0;
const api_request_1 = require("../utils/api-request");
const messaging_errors_internal_1 = require("./messaging-errors-internal");
const index_1 = require("../utils/index");
// FCM backend constants
const FIREBASE_MESSAGING_TIMEOUT = 15000;
const FIREBASE_MESSAGING_HTTP_METHOD = 'POST';
const FIREBASE_MESSAGING_HEADERS = {
    'X-Firebase-Client': `fire-admin-node/${(0, index_1.getSdkVersion)()}`,
    'access_token_auth': 'true',
};
/**
 * Class that provides a mechanism to send requests to the Firebase Cloud Messaging backend.
 */
class FirebaseMessagingRequestHandler {
    /**
     * @param app - The app used to fetch access tokens to sign API requests.
     * @constructor
     */
    constructor(app) {
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
        this.http2Client = new api_request_1.AuthorizedHttp2Client(app);
    }
    /**
     * Invokes the request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the response.
     */
    invokeRequestHandler(host, path, requestData) {
        const request = {
            method: FIREBASE_MESSAGING_HTTP_METHOD,
            url: `https://${host}${path}`,
            data: requestData,
            headers: FIREBASE_MESSAGING_HEADERS,
            timeout: FIREBASE_MESSAGING_TIMEOUT,
        };
        return this.httpClient.send(request).then((response) => {
            // Send non-JSON responses to the catch() below where they will be treated as errors.
            if (!response.isJson()) {
                throw new api_request_1.RequestResponseError(response);
            }
            // Check for backend errors in the response.
            const errorCode = (0, messaging_errors_internal_1.getErrorCode)(response.data);
            if (errorCode) {
                throw new api_request_1.RequestResponseError(response);
            }
            // Return entire response.
            return response.data;
        })
            .catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                throw (0, messaging_errors_internal_1.createFirebaseError)(err);
            }
            // Re-throw the error if it already has the proper format.
            throw err;
        });
    }
    /**
     * Invokes the HTTP/1.1 request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the {@link SendResponse}.
     */
    invokeHttpRequestHandlerForSendResponse(host, path, requestData) {
        const request = {
            method: FIREBASE_MESSAGING_HTTP_METHOD,
            url: `https://${host}${path}`,
            data: requestData,
            headers: FIREBASE_MESSAGING_HEADERS,
            timeout: FIREBASE_MESSAGING_TIMEOUT,
        };
        return this.httpClient.send(request).then((response) => {
            return this.buildSendResponse(response);
        })
            .catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                return this.buildSendResponseFromError(err);
            }
            // Re-throw the error if it already has the proper format.
            throw err;
        });
    }
    /**
     * Invokes the HTTP/2 request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the {@link SendResponse}.
     */
    invokeHttp2RequestHandlerForSendResponse(host, path, requestData, http2SessionHandler) {
        const request = {
            method: FIREBASE_MESSAGING_HTTP_METHOD,
            url: `https://${host}${path}`,
            data: requestData,
            headers: FIREBASE_MESSAGING_HEADERS,
            timeout: FIREBASE_MESSAGING_TIMEOUT,
            http2SessionHandler: http2SessionHandler
        };
        return this.http2Client.send(request).then((response) => {
            return this.buildSendResponse(response);
        })
            .catch((err) => {
            if (err instanceof api_request_1.RequestResponseError) {
                return this.buildSendResponseFromError(err);
            }
            // Re-throw the error if it already has the proper format.
            throw err;
        });
    }
    buildSendResponse(response) {
        const result = {
            success: response.status === 200,
        };
        if (result.success) {
            result.messageId = response.data.name;
        }
        else {
            result.error = (0, messaging_errors_internal_1.createFirebaseError)(new api_request_1.RequestResponseError(response));
        }
        return result;
    }
    buildSendResponseFromError(err) {
        return {
            success: false,
            error: (0, messaging_errors_internal_1.createFirebaseError)(err)
        };
    }
}
exports.FirebaseMessagingRequestHandler = FirebaseMessagingRequestHandler;
